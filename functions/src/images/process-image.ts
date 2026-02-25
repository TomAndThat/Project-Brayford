/**
 * Image Processing — Cloud Function
 *
 * Triggered when a file is finalised in Firebase Storage. For files matching
 * the original image upload path pattern (`images/{orgId}/{imageId}/{filename}`),
 * this function:
 *
 * 1. Downloads the original file to /tmp
 * 2. Generates two WebP variants via sharp:
 *    - thumbnail: 400px wide  (2× the ~200px image picker grid slot)
 *    - display:  1000px wide  (2× the ~500px audience app container)
 * 3. Uploads variants to `images/{orgId}/{imageId}/variants/{name}.webp`
 * 4. Writes stable Firebase download URLs and `uploadStatus: 'processed'`
 *    back to the Firestore image document.
 * 5. Deletes the original file from Storage (only served assets are the
 *    generated variants, so the original is no longer needed).
 *
 * If processing fails, `uploadStatus` is set to `'failed'` so operators
 * can surface and retry affected images. The original file is preserved
 * on failure to allow manual retry.
 *
 * Files already inside a `variants/` subdirectory are skipped to prevent
 * infinite trigger loops.
 */

import {onObjectFinalized} from "firebase-functions/v2/storage";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import * as logger from "firebase-functions/logger";
import sharp from "sharp";
import {randomUUID} from "crypto";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";

/**
 * Brand styling image fields that pair an imageId with a URL.
 * When an image is processed, any brand whose styling references the
 * imageId has its corresponding URL field updated to the display variant.
 */
const BRAND_IMAGE_SLOT_MAP = [
  {idField: "styling.profileImageId", urlField: "styling.profileImageUrl"},
  {idField: "styling.logoImageId", urlField: "styling.logoImageUrl"},
  {idField: "styling.bannerImageId", urlField: "styling.bannerImageUrl"},
  {idField: "styling.headerBackgroundImageId", urlField: "styling.headerBackgroundImageUrl"},
] as const;

/**
 * After variant generation, update any brand documents whose styling
 * references this image ID so their URL fields point to the display
 * variant instead of the (now-deleted) original file.
 */
async function propagateVariantUrlToBrands(
  db: FirebaseFirestore.Firestore,
  orgId: string,
  imageId: string,
  displayUrl: string,
): Promise<void> {
  for (const {idField, urlField} of BRAND_IMAGE_SLOT_MAP) {
    const snapshot = await db
      .collection("brands")
      .where("organizationId", "==", orgId)
      .where(idField, "==", imageId)
      .get();

    for (const doc of snapshot.docs) {
      try {
        await doc.ref.update({
          [urlField]: displayUrl,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: "system",
        });
        logger.info("Propagated variant URL to brand", {
          brandId: doc.id,
          imageId,
          field: urlField,
        });
      } catch (err) {
        logger.warn("Failed to propagate variant URL to brand", {
          brandId: doc.id,
          imageId,
          field: urlField,
          error: String(err),
        });
      }
    }
  }
}

/**
 * Matches original upload paths: images/{orgId}/{imageId}/{filename}
 * Rejects paths with more segments (e.g. variants/).
 */
const ORIGINAL_PATH_REGEX = /^images\/([^/]+)\/([^/]+)\/([^/]+)$/;

const VARIANTS = [
  {name: "thumbnail", width: 400},
  {name: "display", width: 1000},
] as const;

export const onImageUploaded = onObjectFinalized(
  {memory: "512MiB", timeoutSeconds: 120},
  async (event) => {
    const filePath = event.data.name;
    const contentType = event.data.contentType ?? "";

    // Only process recognised image types
    if (!contentType.startsWith("image/")) {
      logger.info("Skipping non-image file", {filePath, contentType});
      return;
    }

    // Only process files at the original upload path depth
    const match = filePath.match(ORIGINAL_PATH_REGEX);
    if (!match) {
      logger.info("Skipping file outside original upload path pattern", {filePath});
      return;
    }

    const [, orgId, imageId] = match;
    logger.info("Processing image", {filePath, orgId, imageId});

    const db = getFirestore();
    const bucket = getStorage().bucket();
    const tmpPath = path.join(os.tmpdir(), `brayford-${imageId}`);

    try {
      // Download original
      await bucket.file(filePath).download({destination: tmpPath});

      const variantUrls: Record<string, string> = {};

      for (const variant of VARIANTS) {
        const variantPath = `images/${orgId}/${imageId}/variants/${variant.name}.webp`;
        const variantFile = bucket.file(variantPath);
        const token = randomUUID();

        const variantBuffer = await sharp(tmpPath)
          .resize({width: variant.width, withoutEnlargement: true})
          .webp({quality: 85})
          .toBuffer();

        // Upload with a Firebase download token embedded in metadata,
        // producing a permanent (non-expiring) download URL.
        await variantFile.save(variantBuffer, {
          metadata: {
            contentType: "image/webp",
            metadata: {
              firebaseStorageDownloadTokens: token,
            },
          },
        });

        // In the emulator the variant file lives on the local Storage emulator,
        // not on production Firebase Storage — so we must use a local URL.
        // FIREBASE_STORAGE_EMULATOR_HOST is set automatically by the emulator
        // runtime (e.g. "127.0.0.1:9199").
        const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
        const baseUrl = emulatorHost
          ? `http://${emulatorHost}/v0/b/${bucket.name}/o`
          : `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o`;

        variantUrls[variant.name] =
          `${baseUrl}/${encodeURIComponent(variantPath)}?alt=media&token=${token}`;
      }

      logger.info("Variants generated", {imageId, variants: Object.keys(variantUrls)});

      await db.collection("images").doc(imageId).update({
        uploadStatus: "processed",
        url: variantUrls.display,
        variants: variantUrls,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: "system",
      });

      // Propagate the display variant URL to any brands that reference
      // this image via an imageId field, replacing the (now-deleted)
      // original URL with the processed variant.
      await propagateVariantUrlToBrands(db, orgId!, imageId!, variantUrls.display!);

      // Delete the original file — variants are the only served assets and
      // the original is no longer needed once processing succeeds.
      await bucket.file(filePath).delete();
      logger.info("Original file deleted", {imageId, filePath});

      logger.info("Image processing complete", {imageId});
    } catch (error) {
      logger.error("Image processing failed", {imageId, filePath, error});

      // Surface the failure on the document so it can be monitored/retried
      try {
        await db.collection("images").doc(imageId).update({
          uploadStatus: "failed",
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: "system",
        });
      } catch (updateError) {
        logger.error("Failed to mark image as failed in Firestore", {imageId, updateError});
      }
    } finally {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    }
  },
);
