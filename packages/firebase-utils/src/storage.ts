/**
 * Firebase Storage utilities for Project Brayford
 *
 * Handles brand image uploads and deletions.
 * Storage path convention: brands/{brandId}/header/{imageType}-{timestamp}.{ext}
 */

import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  type StorageReference,
} from 'firebase/storage';
import { storage } from './config';
import {
  validateUploadFile,
  validateImageDimensions,
  ALLOWED_IMAGE_MIME_TYPES_SET,
} from '@brayford/core';

/** Image types that can be uploaded for a brand header */
export type BrandImageType = 'profile' | 'logo' | 'banner' | 'header-background';

/** Result of a successful upload */
export interface UploadResult {
  /** Public download URL for the uploaded image */
  url: string;
  /** Full storage path (for deletion) */
  storagePath: string;
}

/**
 * Map MIME type to file extension
 */
function mimeToExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  };
  return map[mimeType] ?? 'bin';
}

/**
 * Build the storage path for a brand image.
 *
 * @param brandId - The brand's ID
 * @param imageType - Which image slot this is for
 * @param mimeType - The file's MIME type (determines extension)
 * @returns The full storage path
 */
function buildStoragePath(
  brandId: string,
  imageType: BrandImageType,
  mimeType: string,
): string {
  const ext = mimeToExtension(mimeType);
  const timestamp = Date.now();
  return `brands/${brandId}/header/${imageType}-${timestamp}.${ext}`;
}

/**
 * Load a File/Blob as an HTMLImageElement to check its dimensions.
 * Skips validation for SVGs (they're vector and resolution-independent).
 *
 * @returns The loaded image's natural dimensions, or null for SVGs
 */
function loadImageDimensions(
  file: Blob,
): Promise<{ width: number; height: number } | null> {
  // SVGs are vector — skip dimension checks
  if (file.type === 'image/svg+xml') {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for dimension validation'));
    };
    img.src = url;
  });
}

/**
 * Validate a file for upload (type, size, and dimensions).
 *
 * @param file - The file to validate
 * @returns null if valid, or an error message string
 */
export async function validateBrandImage(file: File): Promise<string | null> {
  // Check type and size
  const basicError = validateUploadFile(file);
  if (basicError) return basicError;

  // Check dimensions (skip for SVG)
  const dims = await loadImageDimensions(file);
  if (dims) {
    const dimError = validateImageDimensions(dims.width, dims.height);
    if (dimError) return dimError;
  }

  return null;
}

/**
 * Upload a brand image to Firebase Storage.
 *
 * Validates the file before uploading. Call `validateBrandImage` separately
 * if you want to show errors before initiating the upload.
 *
 * @param brandId - The brand to upload the image for
 * @param file - The image file (or Blob from crop)
 * @param imageType - Which image slot this fills
 * @returns The download URL and storage path
 * @throws Error if validation fails or upload fails
 */
export async function uploadBrandImage(
  brandId: string,
  file: File | Blob,
  imageType: BrandImageType,
): Promise<UploadResult> {
  // Determine MIME type
  const mimeType = file.type;
  if (!ALLOWED_IMAGE_MIME_TYPES_SET.has(mimeType)) {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  const storagePath = buildStoragePath(brandId, imageType, mimeType);
  const storageRef: StorageReference = ref(storage, storagePath);

  // Upload the file
  const snapshot = await uploadBytes(storageRef, file, {
    contentType: mimeType,
    // Cache for 1 hour, allow CDN caching for 24 hours
    customMetadata: {
      brandId,
      imageType,
    },
  });

  // Get the public download URL
  const url = await getDownloadURL(snapshot.ref);

  return { url, storagePath };
}

/**
 * Delete a brand image from Firebase Storage by its download URL.
 *
 * Silently ignores "object not found" errors (already deleted).
 *
 * @param downloadUrl - The full download URL returned by uploadBrandImage
 */
export async function deleteBrandImage(downloadUrl: string): Promise<void> {
  try {
    // Extract the storage path from the download URL
    // Firebase download URLs contain the path encoded in the URL
    const storageRef = ref(storage, extractPathFromUrl(downloadUrl));
    await deleteObject(storageRef);
  } catch (error: unknown) {
    // Ignore "object not found" — already deleted
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code: string }).code === 'storage/object-not-found'
    ) {
      return;
    }
    throw error;
  }
}

/**
 * Extract the storage path from a Firebase download URL.
 *
 * Firebase download URLs look like:
 * https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encodedPath}?alt=media&token=...
 * Or for emulator:
 * http://localhost:9199/v0/b/{bucket}/o/{encodedPath}?alt=media&token=...
 *
 * @param url - The download URL
 * @returns The decoded storage path
 */
function extractPathFromUrl(url: string): string {
  const match = url.match(/\/o\/(.+?)(\?|$)/);
  if (!match) {
    throw new Error(`Cannot extract storage path from URL: ${url}`);
  }
  return decodeURIComponent(match[1]!);
}
