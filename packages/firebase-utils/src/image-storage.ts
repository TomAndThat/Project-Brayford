/**
 * Firebase Storage utilities for image library
 *
 * Handles client-side image uploads and deletions for the
 * organization-level image library.
 *
 * Storage path convention: images/{organizationId}/{imageId}/{filename}
 */

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type UploadTask,
} from 'firebase/storage';
import { storage } from './config';
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  type AcceptedImageType,
} from '@brayford/core';

/** Result of a completed image upload */
export interface ImageUploadResult {
  /** Public download URL */
  url: string;
  /** Full storage path (for deletion) */
  storagePath: string;
}

/** Progress callback for upload tracking */
export type UploadProgressCallback = (progress: number) => void;

/**
 * Build the storage path for an image library asset.
 *
 * @param organizationId - The organization's ID
 * @param imageId - The image's ID
 * @param filename - Original filename
 * @returns The full storage path
 */
export function buildImageStoragePath(
  organizationId: string,
  imageId: string,
  filename: string,
): string {
  return `images/${organizationId}/${imageId}/${filename}`;
}

/**
 * Validate an image file for the image library.
 *
 * Checks file type and size against the image schema constraints.
 *
 * @param file - The file to validate
 * @returns null if valid, or an error message string
 */
export function validateImageFile(file: File): string | null {
  const acceptedTypes = ACCEPTED_IMAGE_TYPES as readonly string[];
  if (!acceptedTypes.includes(file.type)) {
    return `Unsupported file type: ${file.type}. Accepted types: JPEG, PNG, WebP, GIF.`;
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    const maxMB = MAX_IMAGE_SIZE_BYTES / (1024 * 1024);
    return `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum of ${maxMB} MB.`;
  }

  return null;
}

/**
 * Extract image dimensions from a File using the browser Image API.
 *
 * @param file - Image file to measure
 * @returns Promise resolving to { width, height }
 */
export function extractImageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for dimension extraction'));
    };
    img.src = url;
  });
}

/**
 * Upload an image file to Firebase Storage for the image library.
 *
 * Uses uploadBytesResumable for progress tracking.
 *
 * @param storagePath - Full storage path (from buildImageStoragePath)
 * @param file - The image file to upload
 * @param onProgress - Optional progress callback (0-100)
 * @returns Promise resolving to { url, storagePath }
 */
export async function uploadImageFile(
  storagePath: string,
  file: File,
  onProgress?: UploadProgressCallback,
): Promise<ImageUploadResult> {
  const storageRef = ref(storage, storagePath);

  return new Promise<ImageUploadResult>((resolve, reject) => {
    const uploadTask: UploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
    });

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (onProgress) {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress(Math.round(progress));
        }
      },
      (error) => {
        reject(error);
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({ url, storagePath });
        } catch (error) {
          reject(error);
        }
      },
    );
  });
}

/**
 * Delete an image from Firebase Storage by its storage path.
 *
 * Silently ignores "object not found" errors (already deleted).
 *
 * @param storagePath - The full storage path of the image
 */
export async function deleteImageFile(storagePath: string): Promise<void> {
  try {
    const storageRef = ref(storage, storagePath);
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
