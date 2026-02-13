/**
 * Image Schema - Asset Management Domain
 *
 * Images represent uploaded assets stored in Firebase Storage and managed
 * at the organization level. They are referenced by brands (styling),
 * scenes (content modules), and other entities that require visual media.
 *
 * Users can attach free-form tags for filtering and discovery.
 * Reference tracking prevents deletion of in-use images.
 *
 * Firestore Collection: /images/{imageId}
 * Storage Path: /images/{organizationId}/{imageId}/{filename}
 */

import { z } from 'zod';
import type { ImageId, OrganizationId, UserId, BrandId, SceneId } from '../types/branded';

/**
 * Accepted image content types.
 *
 * SVG is intentionally excluded – it requires different security
 * considerations and is out of scope for now.
 */
export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];

/**
 * Maximum image file size in bytes (10 MB).
 */
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Maximum number of tags per image.
 */
export const MAX_TAGS_PER_IMAGE = 20;

/**
 * Maximum tag length in characters.
 */
export const MAX_TAG_LENGTH = 50;

/**
 * Image dimensions schema
 */
export const ImageDimensionsSchema = z.object({
  width: z.number().int().positive().describe('Image width in pixels'),
  height: z.number().int().positive().describe('Image height in pixels'),
});

export type ImageDimensions = z.infer<typeof ImageDimensionsSchema>;

/**
 * Tracks which entities reference an image.
 * Updated automatically via Cloud Functions when brands/scenes change.
 */
export const ImageUsedBySchema = z.object({
  brands: z.array(z.string()).default([]).describe('Brand IDs referencing this image'),
  scenes: z.array(z.string()).default([]).describe('Scene IDs referencing this image'),
});

export type ImageUsedBy = z.infer<typeof ImageUsedBySchema>;

/**
 * Upload status governs the image lifecycle.
 *
 * - pending:   Firestore doc created, client is uploading to Storage
 * - ready:     Upload confirmed, image available for use
 * - failed:    Upload did not complete (can be retried or cleaned up)
 */
export const ImageUploadStatusSchema = z.enum(['pending', 'ready', 'failed']);
export type ImageUploadStatus = z.infer<typeof ImageUploadStatusSchema>;

/**
 * Full image document schema.
 *
 * @property organizationId - Owning organization
 * @property name           - User-friendly display name
 * @property description    - Optional notes
 * @property tags           - Free-form user tags for filtering/search
 * @property storagePath    - Firebase Storage path
 * @property url            - Public download URL
 * @property filename       - Original filename (with extension)
 * @property contentType    - MIME type
 * @property sizeBytes      - File size for storage tracking
 * @property dimensions     - Width and height in pixels
 * @property uploadStatus   - Lifecycle status
 * @property usageCount     - How many entities reference this image
 * @property usedBy         - Denormalized reference lists
 * @property createdAt      - Creation timestamp
 * @property createdBy      - Uploading user
 * @property updatedAt      - Last modification timestamp
 * @property updatedBy      - User who last modified metadata
 * @property isActive       - Soft-delete flag (reserved for future use)
 */
export const ImageSchema = z.object({
  organizationId: z.string().min(1).describe('Owning organization'),
  name: z.string().min(1).max(200).describe('User-friendly display name'),
  description: z.string().max(500).optional().describe('Optional notes'),
  tags: z.array(
    z.string().min(1).max(MAX_TAG_LENGTH),
  ).max(MAX_TAGS_PER_IMAGE).default([]).describe('Free-form user tags'),
  storagePath: z.string().min(1).describe('Firebase Storage path'),
  url: z.string().url().describe('Public download URL'),
  filename: z.string().min(1).max(255).describe('Original filename'),
  contentType: z.enum(ACCEPTED_IMAGE_TYPES).describe('MIME content type'),
  sizeBytes: z.number().int().positive().max(MAX_IMAGE_SIZE_BYTES).describe('File size in bytes'),
  dimensions: ImageDimensionsSchema.describe('Image dimensions'),
  uploadStatus: ImageUploadStatusSchema.default('pending').describe('Upload lifecycle status'),
  usageCount: z.number().int().min(0).default(0).describe('Number of entities referencing this image'),
  usedBy: ImageUsedBySchema.default({ brands: [], scenes: [] }).describe('Entities referencing this image'),
  createdAt: z.date().describe('Upload timestamp'),
  createdBy: z.string().min(1).describe('User who uploaded the image'),
  updatedAt: z.date().describe('Last modification timestamp'),
  updatedBy: z.string().min(1).describe('User who last modified metadata'),
  isActive: z.boolean().default(true).describe('Soft-delete flag'),
});

export type Image = z.infer<typeof ImageSchema>;

/**
 * Image document with branded typed IDs.
 */
export interface ImageDocument extends Omit<Image, 'organizationId' | 'createdBy' | 'updatedBy'> {
  id: ImageId;
  organizationId: OrganizationId;
  createdBy: UserId;
  updatedBy: UserId;
  usedBy: {
    brands: BrandId[];
    scenes: SceneId[];
  };
}

/**
 * Data required to initiate an image upload.
 *
 * The API route creates the Firestore document with `uploadStatus: 'pending'`
 * and returns a signed upload URL. The client uploads directly to Storage
 * then calls the confirm endpoint.
 */
export const CreateImageSchema = z.object({
  organizationId: z.string().min(1).describe('Owning organization'),
  name: z.string().min(1).max(200).describe('Display name'),
  description: z.string().max(500).optional().describe('Optional notes'),
  tags: z.array(
    z.string().min(1).max(MAX_TAG_LENGTH),
  ).max(MAX_TAGS_PER_IMAGE).default([]).describe('Free-form user tags'),
  filename: z.string().min(1).max(255).describe('Original filename'),
  contentType: z.enum(ACCEPTED_IMAGE_TYPES).describe('MIME content type'),
  sizeBytes: z.number().int().positive().max(MAX_IMAGE_SIZE_BYTES).describe('File size in bytes'),
  dimensions: ImageDimensionsSchema.describe('Image dimensions'),
  createdBy: z.string().min(1).describe('Uploading user'),
});

export type CreateImageData = z.infer<typeof CreateImageSchema>;

/**
 * Data for updating image metadata.
 * Storage path, URL, file properties, and organizationId are immutable.
 */
export const UpdateImageMetadataSchema = z.object({
  name: z.string().min(1).max(200).optional().describe('Display name'),
  description: z.string().max(500).optional().nullable().describe('Optional notes'),
  tags: z.array(
    z.string().min(1).max(MAX_TAG_LENGTH),
  ).max(MAX_TAGS_PER_IMAGE).optional().describe('Free-form user tags'),
  updatedBy: z.string().min(1).describe('User making the change'),
});

export type UpdateImageMetadataData = z.infer<typeof UpdateImageMetadataSchema>;

// ===== Validation Helpers =====

/**
 * Validate a full image document from Firestore.
 */
export function validateImageData(data: unknown): Image {
  return ImageSchema.parse(data);
}

/**
 * Validate data for creating a new image.
 */
export function validateCreateImageData(data: unknown): CreateImageData {
  return CreateImageSchema.parse(data);
}

/**
 * Validate data for updating image metadata.
 */
export function validateUpdateImageMetadataData(data: unknown): UpdateImageMetadataData {
  return UpdateImageMetadataSchema.parse(data);
}

// ===== Name Deduplication =====

/**
 * Generate a unique image name when a duplicate exists.
 *
 * Given an intended name and an array of existing names in the org,
 * appends " (1)", " (2)", etc. until a unique name is found.
 *
 * @example
 * ```ts
 * deduplicateImageName('logo', ['logo', 'logo (1)']); // 'logo (2)'
 * deduplicateImageName('banner', ['logo']); // 'banner'
 * ```
 */
export function deduplicateImageName(
  intendedName: string,
  existingNames: string[],
): string {
  const nameSet = new Set(existingNames);
  if (!nameSet.has(intendedName)) {
    return intendedName;
  }
  let counter = 1;
  while (nameSet.has(`${intendedName} (${counter})`)) {
    counter++;
  }
  return `${intendedName} (${counter})`;
}
