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
 * Extract the storage path from a Firebase download URL.
 *
 * Firebase download URLs look like:
 * https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encodedPath}?alt=media&token=...
 */
function extractPathFromDownloadUrl(url: string): string | null {
  try {
    const match = url.match(/\/o\/(.+?)(\?|$)/);
    if (!match) return null;
    return decodeURIComponent(match[1]!);
  } catch {
    return null;
  }
}

/**
 * Delete a file from Storage by its download URL.
 * Silently ignores "not found" errors.
 */
async function deleteFileByUrl(url: string): Promise<void> {
  const path = extractPathFromDownloadUrl(url);
  if (!path) {
    logger.warn("Could not extract storage path from URL", {url});
    return;
  }

  try {
    const bucket = getStorage().bucket();
    await bucket.file(path).delete();
    logger.info("Deleted orphaned brand image", {path});
  } catch (error: unknown) {
    // Ignore "not found" — file already deleted
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as {code: number}).code === 404
    ) {
      logger.info("Brand image already deleted", {path});
      return;
    }
    logger.error("Failed to delete brand image", {path, error});
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

    // Delete in parallel
    await Promise.allSettled(urlsToDelete.map(deleteFileByUrl));
  }
);
