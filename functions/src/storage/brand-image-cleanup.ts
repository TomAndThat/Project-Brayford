/**
 * Brand Image Cleanup - Cloud Function
 *
 * Triggered when a brand document is updated. Compares old and new image URLs
 * and deletes any orphaned images from Firebase Storage.
 *
 * This handles:
 * - Replacing an image (old URL removed, new URL set)
 * - Switching header types (old type's image becomes orphaned)
 * - Setting header to "none" (all header images become orphaned)
 * - Removing an image without replacement
 */

import {onDocumentUpdated} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import {getStorage} from "firebase-admin/storage";

/** Brand styling image URL fields that can hold Storage references */
const IMAGE_URL_FIELDS = [
  "profileImageUrl",
  "logoImageUrl",
  "bannerImageUrl",
  "headerBackgroundImageUrl",
] as const;

/**
 * Extract the image folder prefix from a Firebase download URL.
 *
 * Firebase download URLs look like:
 * https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encodedPath}?alt=media&token=...
 *
 * The encoded path will be something like:
 *   images/{orgId}/{imageId}/variants/display.webp
 *
 * We extract `images/{orgId}/{imageId}/` so we can delete the entire folder,
 * cleaning up all variants and any orphaned files.
 */
function extractImageFolderPrefix(url: string): string | null {
  try {
    const match = url.match(/\/o\/(.+?)(\?|$)/);
    if (!match) return null;
    const fullPath = decodeURIComponent(match[1]!);

    // Match images/{orgId}/{imageId}/ at the start of the path
    const folderMatch = fullPath.match(/^(images\/[^/]+\/[^/]+\/)/);
    if (!folderMatch) return null;

    return folderMatch[1]!;
  } catch {
    return null;
  }
}

/**
 * Delete all files under an image folder prefix from Storage.
 * This removes the original (if still present) and all variants.
 * Silently ignores "not found" errors.
 */
async function deleteImageFolder(url: string): Promise<void> {
  const prefix = extractImageFolderPrefix(url);
  if (!prefix) {
    logger.warn("Could not extract image folder prefix from URL", {url});
    return;
  }

  try {
    const bucket = getStorage().bucket();
    await bucket.deleteFiles({prefix});
    logger.info("Deleted orphaned brand image folder", {prefix});
  } catch (error: unknown) {
    // Ignore "not found" — files already deleted
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as {code: number}).code === 404
    ) {
      logger.info("Brand image folder already deleted", {prefix});
      return;
    }
    logger.error("Failed to delete brand image folder", {prefix, error});
  }
}

/**
 * Firestore trigger: Clean up orphaned brand images when brand styling changes.
 *
 * Compares before/after styling.* image URL fields. If a URL was present before
 * but is absent (or different) after, the old file is deleted from Storage.
 */
export const onBrandStylingChange = onDocumentUpdated(
  {
    document: "brands/{brandId}",
    maxInstances: 5,
  },
  async (event) => {
    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();

    if (!beforeData || !afterData) return;

    const beforeStyling = (beforeData.styling ?? {}) as Record<string, unknown>;
    const afterStyling = (afterData.styling ?? {}) as Record<string, unknown>;

    const urlsToDelete: string[] = [];

    for (const field of IMAGE_URL_FIELDS) {
      const oldUrl = beforeStyling[field];
      const newUrl = afterStyling[field];

      // If there was a URL before, and it's now different or removed, delete it
      if (
        typeof oldUrl === "string" &&
        oldUrl.length > 0 &&
        oldUrl !== newUrl
      ) {
        urlsToDelete.push(oldUrl);
      }
    }

    if (urlsToDelete.length === 0) {
      return;
    }

    logger.info("Cleaning up orphaned brand images", {
      brandId: event.params.brandId,
      count: urlsToDelete.length,
    });

    // Delete in parallel — each call removes the entire image folder
    await Promise.allSettled(urlsToDelete.map(deleteImageFolder));
  }
);
