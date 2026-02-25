/**
 * Upload validation utilities for Project Brayford
 *
 * Client-side and server-side image upload validation.
 * Size and MIME type constraints are imported from `image.schema.ts`
 * (single source of truth for image constraints).
 */

import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_SIZE_BYTES,
} from '../schemas/image.schema';

/** Human-readable max file size label */
export const MAX_UPLOAD_FILE_SIZE_LABEL = '10 MB';

/** Maximum image dimension in pixels (1024px — 2× retina for 500px container) */
export const MAX_IMAGE_DIMENSION = 1024;

/**
 * Re-export canonical constants under upload-specific aliases for
 * consumers that import from this module.
 */
export const MAX_UPLOAD_FILE_SIZE = MAX_IMAGE_SIZE_BYTES;
export const ALLOWED_IMAGE_MIME_TYPES = ACCEPTED_IMAGE_TYPES;

/** Allowed MIME types as a Set for fast lookup */
export const ALLOWED_IMAGE_MIME_TYPES_SET = new Set<string>(ACCEPTED_IMAGE_TYPES);

/** Human-readable allowed formats */
export const ALLOWED_IMAGE_FORMATS_LABEL = 'PNG, JPEG, WebP, GIF';

/** Allowed header types for brand styling */
export const HEADER_TYPES = ['none', 'profile', 'logo', 'banner'] as const;

/**
 * Validate that a file meets upload requirements (type + size).
 * Does NOT validate dimensions — that requires loading the image.
 *
 * @returns null if valid, or an error message string
 */
export function validateUploadFile(file: { type: string; size: number }): string | null {
  if (!ALLOWED_IMAGE_MIME_TYPES_SET.has(file.type)) {
    return `Unsupported file type. Allowed formats: ${ALLOWED_IMAGE_FORMATS_LABEL}`;
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return `File is too large. Maximum size is ${MAX_UPLOAD_FILE_SIZE_LABEL}`;
  }

  return null;
}

/**
 * Validate image dimensions. Call after loading the file into an HTMLImageElement.
 *
 * @returns null if valid, or an error message string
 */
export function validateImageDimensions(
  width: number,
  height: number,
): string | null {
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    return `Image dimensions exceed ${MAX_IMAGE_DIMENSION}×${MAX_IMAGE_DIMENSION}px. Please resize before uploading.`;
  }

  return null;
}
