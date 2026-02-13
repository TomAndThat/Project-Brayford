/**
 * Image Reference Tracking — Cloud Functions
 *
 * Firestore triggers that keep image `usedBy` and `usageCount` fields
 * in sync as brands and scenes create, update, or delete references.
 *
 * Watched entities:
 * - brands/{brandId}  → styling image URL fields
 * - scenes/{sceneId}  → module config values (any URL pointing to the images path)
 *
 * How it works:
 * 1. Extract image IDs from before/after document snapshots
 * 2. Diff the two sets to find added and removed references
 * 3. Update each affected image document's `usedBy` array + `usageCount`
 *
 * Storage path pattern: images/{orgId}/{imageId}/{filename}
 */

import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import {getFirestore, FieldValue} from "firebase-admin/firestore";

// ===== Helpers =====

/**
 * Extract the storage path from a Firebase download URL.
 *
 * Firebase download URLs look like:
 * https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encodedPath}?alt=media&token=...
 *
 * Or in the emulator:
 * http://127.0.0.1:9199/v0/b/{bucket}/o/{encodedPath}?alt=media&token=...
 */
function extractStoragePath(url: string): string | null {
  try {
    const match = url.match(/\/o\/(.+?)(\?|$)/);
    if (!match) return null;
    return decodeURIComponent(match[1]!);
  } catch {
    return null;
  }
}

/**
 * Extract an image ID from a Firebase Storage URL pointing to the images path.
 *
 * Expects path pattern: images/{orgId}/{imageId}/{filename}
 * Returns the {imageId} segment or null if the URL doesn't match.
 */
function extractImageId(url: string): string | null {
  const path = extractStoragePath(url);
  if (!path) return null;

  // images/{orgId}/{imageId}/{filename}
  const segments = path.split("/");
  if (segments.length < 4 || segments[0] !== "images") return null;

  return segments[2] || null;
}

/**
 * Recursively collect all string values from a nested object.
 * Used to scan scene module `config` objects for image URLs.
 */
function collectStringValues(obj: unknown): string[] {
  if (typeof obj === "string") return [obj];
  if (Array.isArray(obj)) return obj.flatMap(collectStringValues);
  if (obj && typeof obj === "object") {
    return Object.values(obj as Record<string, unknown>).flatMap(collectStringValues);
  }
  return [];
}

// ===== Brand image fields =====

const BRAND_IMAGE_URL_FIELDS = [
  "profileImageUrl",
  "logoImageUrl",
  "bannerImageUrl",
  "headerBackgroundImageUrl",
] as const;

const BRAND_IMAGE_ID_FIELDS = [
  "profileImageId",
  "logoImageId",
  "bannerImageId",
  "headerBackgroundImageId",
] as const;

/**
 * Extract image IDs from a brand document's styling section.
 *
 * Prefers explicit imageId fields when present, falls back to
 * extracting IDs from download URLs for backwards compatibility.
 */
function extractBrandImageIds(data: Record<string, unknown> | undefined): Set<string> {
  const ids = new Set<string>();
  if (!data) return ids;

  const styling = (data.styling ?? {}) as Record<string, unknown>;

  // Check explicit imageId fields first
  for (const field of BRAND_IMAGE_ID_FIELDS) {
    const id = styling[field];
    if (typeof id === "string" && id.length > 0) {
      ids.add(id);
    }
  }

  // Fall back to URL parsing (for any references not covered by ID fields)
  for (const field of BRAND_IMAGE_URL_FIELDS) {
    const url = styling[field];
    if (typeof url === "string" && url.length > 0) {
      const imageId = extractImageId(url);
      if (imageId) ids.add(imageId);
    }
  }

  return ids;
}

/**
 * Extract image IDs from a scene document's modules array.
 * Scans every config value for URLs matching the images storage path.
 */
function extractSceneImageIds(data: Record<string, unknown> | undefined): Set<string> {
  const ids = new Set<string>();
  if (!data) return ids;

  const modules = data.modules;
  if (!Array.isArray(modules)) return ids;

  for (const mod of modules) {
    if (!mod || typeof mod !== "object") continue;
    const config = (mod as Record<string, unknown>).config;
    if (!config) continue;

    const strings = collectStringValues(config);
    for (const str of strings) {
      // Quick pre-check to avoid unnecessary regex
      if (str.includes("/images/")) {
        const imageId = extractImageId(str);
        if (imageId) ids.add(imageId);
      }
    }
  }

  return ids;
}

// ===== Diff + Update =====

/**
 * Given before/after sets of image IDs, update the affected image documents.
 *
 * @param beforeIds - Image IDs referenced in the old document
 * @param afterIds  - Image IDs referenced in the new document
 * @param refType   - "brands" or "scenes"
 * @param refId     - The entity ID (brandId or sceneId) being tracked
 */
async function updateImageReferences(
  beforeIds: Set<string>,
  afterIds: Set<string>,
  refType: "brands" | "scenes",
  refId: string,
): Promise<void> {
  const db = getFirestore();

  // IDs that were added (present in after but not in before)
  const added = [...afterIds].filter((id) => !beforeIds.has(id));
  // IDs that were removed (present in before but not in after)
  const removed = [...beforeIds].filter((id) => !afterIds.has(id));

  if (added.length === 0 && removed.length === 0) return;

  const usedByField = `usedBy.${refType}`;

  const promises: Promise<void>[] = [];

  for (const imageId of added) {
    const imageRef = db.collection("images").doc(imageId);
    promises.push(
      imageRef.update({
        [usedByField]: FieldValue.arrayUnion(refId),
        usageCount: FieldValue.increment(1),
      }).then(() => {
        logger.info("Added image reference", {imageId, refType, refId});
      }).catch((err) => {
        // Image may have been deleted — log and skip
        logger.warn("Failed to add image reference (image may not exist)", {
          imageId, refType, refId, error: String(err),
        });
      }),
    );
  }

  for (const imageId of removed) {
    const imageRef = db.collection("images").doc(imageId);
    promises.push(
      imageRef.update({
        [usedByField]: FieldValue.arrayRemove(refId),
        usageCount: FieldValue.increment(-1),
      }).then(() => {
        logger.info("Removed image reference", {imageId, refType, refId});
      }).catch((err) => {
        logger.warn("Failed to remove image reference (image may not exist)", {
          imageId, refType, refId, error: String(err),
        });
      }),
    );
  }

  await Promise.allSettled(promises);
}

// ===== Trigger: Brands =====

/**
 * Firestore trigger: Track image references in brand documents.
 *
 * Fires on create, update, and delete of brand documents.
 * Compares before/after styling image URLs and updates corresponding
 * image documents' `usedBy.brands` arrays and `usageCount`.
 */
export const onBrandImageReferencesChange = onDocumentWritten(
  {
    document: "brands/{brandId}",
    maxInstances: 5,
  },
  async (event) => {
    const brandId = event.params.brandId;
    const beforeData = event.data?.before?.data() as Record<string, unknown> | undefined;
    const afterData = event.data?.after?.data() as Record<string, unknown> | undefined;

    const beforeIds = extractBrandImageIds(beforeData);
    const afterIds = extractBrandImageIds(afterData);

    await updateImageReferences(beforeIds, afterIds, "brands", brandId);
  },
);

// ===== Trigger: Scenes =====

/**
 * Firestore trigger: Track image references in scene documents.
 *
 * Fires on create, update, and delete of scene documents.
 * Scans module configs for image URLs and updates corresponding
 * image documents' `usedBy.scenes` arrays and `usageCount`.
 */
export const onSceneImageReferencesChange = onDocumentWritten(
  {
    document: "scenes/{sceneId}",
    maxInstances: 5,
  },
  async (event) => {
    const sceneId = event.params.sceneId;
    const beforeData = event.data?.before?.data() as Record<string, unknown> | undefined;
    const afterData = event.data?.after?.data() as Record<string, unknown> | undefined;

    const beforeIds = extractSceneImageIds(beforeData);
    const afterIds = extractSceneImageIds(afterData);

    await updateImageReferences(beforeIds, afterIds, "scenes", sceneId);
  },
);
