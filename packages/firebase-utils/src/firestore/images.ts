/**
 * Image Firestore Operations
 * Asset Management Domain
 *
 * CRUD operations for the images collection.
 * Images are organization-level assets stored in Firebase Storage
 * and referenced by brands, scenes, and other entities.
 *
 * @see packages/core/src/schemas/image.schema.ts
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  serverTimestamp,
  type DocumentReference,
} from 'firebase/firestore';
import { db } from '../config';
import { createConverter, convertFromFirestore } from './converters';
import {
  validateImageData,
  type Image,
  type ImageDocument,
  type CreateImageData,
  type UpdateImageMetadataData,
  type ImageUploadStatus,
  toBranded,
  fromBranded,
  type ImageId,
  type OrganizationId,
  type UserId,
  type BrandId,
  type SceneId,
} from '@brayford/core';

/**
 * Timestamp fields on the Image document that need Firestore conversion
 */
const IMAGE_TIMESTAMP_FIELDS = ['createdAt', 'updatedAt'];

/**
 * Firestore converter for Image documents
 */
const imageConverter = createConverter(validateImageData, IMAGE_TIMESTAMP_FIELDS);

/**
 * Get reference to an image document
 */
export function getImageRef(imageId: ImageId): DocumentReference<Image> {
  return doc(db, 'images', fromBranded(imageId)).withConverter(imageConverter);
}

/**
 * Get image by ID
 *
 * @param imageId - Image ID (branded type)
 * @returns Image document or null if not found
 *
 * @example
 * ```ts
 * const image = await getImage(imageId);
 * if (image) {
 *   console.log(image.name, image.url);
 * }
 * ```
 */
export async function getImage(imageId: ImageId): Promise<ImageDocument | null> {
  const imageRef = getImageRef(imageId);
  const imageSnap = await getDoc(imageRef);

  if (!imageSnap.exists()) {
    return null;
  }

  const data = imageSnap.data();
  return toImageDocument(imageId, data);
}

/**
 * Create a new image document
 *
 * @param imageId - Pre-generated image ID
 * @param data - Image creation data
 *
 * @example
 * ```ts
 * await createImage(imageId, {
 *   organizationId: fromBranded(orgId),
 *   name: 'Logo',
 *   filename: 'logo.png',
 *   contentType: 'image/png',
 *   sizeBytes: 102400,
 *   dimensions: { width: 512, height: 512 },
 *   createdBy: fromBranded(userId),
 * });
 * ```
 */
export async function createImage(
  imageId: ImageId,
  data: CreateImageData & {
    storagePath: string;
    url: string;
    uploadStatus: ImageUploadStatus;
    usageCount: number;
    usedBy: { brands: string[]; scenes: string[] };
    isActive: boolean;
  },
): Promise<void> {
  const imageRef = doc(db, 'images', fromBranded(imageId));

  // Strip undefined values — Firestore rejects them
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined),
  );

  await setDoc(imageRef, {
    ...cleanData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Update image metadata
 *
 * @param imageId - Image ID to update
 * @param data - Metadata fields to update
 *
 * @example
 * ```ts
 * await updateImageMetadata(imageId, {
 *   name: 'Updated Logo',
 *   tags: ['branding', 'logo'],
 *   updatedBy: fromBranded(userId),
 * });
 * ```
 */
export async function updateImageMetadata(
  imageId: ImageId,
  data: UpdateImageMetadataData,
): Promise<void> {
  const imageRef = doc(db, 'images', fromBranded(imageId));

  // Strip undefined values
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined),
  );

  await updateDoc(imageRef, {
    ...cleanData,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Update image upload status and URL after successful upload
 *
 * @param imageId - Image ID to confirm
 * @param url - Public download URL
 * @param updatedBy - User confirming the upload
 */
export async function confirmImageUpload(
  imageId: ImageId,
  url: string,
  updatedBy: string,
): Promise<void> {
  const imageRef = doc(db, 'images', fromBranded(imageId));
  await updateDoc(imageRef, {
    uploadStatus: 'ready',
    url,
    updatedBy,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete an image document permanently
 *
 * @param imageId - Image ID to delete
 */
export async function deleteImage(imageId: ImageId): Promise<void> {
  const imageRef = doc(db, 'images', fromBranded(imageId));
  await deleteDoc(imageRef);
}

/**
 * Get all images for an organization
 *
 * @param organizationId - Organization ID
 * @param options - Optional filters
 * @param options.uploadStatus - Filter by upload status (default: 'ready')
 * @param options.tag - Filter by tag
 * @param options.activeOnly - Only return active images (default: true)
 * @returns Array of image documents
 *
 * @example
 * ```ts
 * // Get all ready images
 * const images = await getOrganizationImages(orgId);
 *
 * // Get images with a specific tag
 * const logos = await getOrganizationImages(orgId, { tag: 'logo' });
 * ```
 */
export async function getOrganizationImages(
  organizationId: OrganizationId,
  options: {
    uploadStatus?: ImageUploadStatus;
    tag?: string;
    activeOnly?: boolean;
  } = {},
): Promise<ImageDocument[]> {
  const { uploadStatus = 'ready', activeOnly = true } = options;

  let imagesQuery = query(
    collection(db, 'images'),
    where('organizationId', '==', fromBranded(organizationId)),
    where('isActive', '==', activeOnly),
    where('uploadStatus', '==', uploadStatus),
    orderBy('createdAt', 'desc'),
  );

  const querySnap = await getDocs(imagesQuery);

  let images = querySnap.docs.map((docSnap) => {
    const data = convertFromFirestore(docSnap.data(), validateImageData, IMAGE_TIMESTAMP_FIELDS);
    return toImageDocument(toBranded<ImageId>(docSnap.id), data);
  });

  // Client-side tag filter (Firestore doesn't support array-contains + multiple where efficiently)
  if (options.tag) {
    const tagLower = options.tag.toLowerCase();
    images = images.filter((img) =>
      img.tags.some((t) => t.toLowerCase() === tagLower),
    );
  }

  return images;
}

/**
 * Get all image names for an organization (for deduplication)
 *
 * @param organizationId - Organization ID
 * @returns Array of image names
 */
export async function getOrganizationImageNames(
  organizationId: OrganizationId,
): Promise<string[]> {
  const imagesQuery = query(
    collection(db, 'images'),
    where('organizationId', '==', fromBranded(organizationId)),
    where('isActive', '==', true),
  );

  const querySnap = await getDocs(imagesQuery);
  return querySnap.docs.map((docSnap) => docSnap.data().name as string);
}

/**
 * Check if an image exists
 *
 * @param imageId - Image ID (branded type)
 * @returns True if image document exists
 */
export async function imageExists(imageId: ImageId): Promise<boolean> {
  const imageRef = getImageRef(imageId);
  const imageSnap = await getDoc(imageRef);
  return imageSnap.exists();
}

// ===== Internal Helpers =====

/**
 * Convert raw Image data to ImageDocument with branded IDs
 */
function toImageDocument(imageId: ImageId, data: Image): ImageDocument {
  return {
    id: imageId,
    ...data,
    organizationId: toBranded<OrganizationId>(data.organizationId),
    createdBy: toBranded<UserId>(data.createdBy),
    updatedBy: toBranded<UserId>(data.updatedBy),
    usedBy: {
      brands: (data.usedBy?.brands || []).map((id) => toBranded<BrandId>(id)),
      scenes: (data.usedBy?.scenes || []).map((id) => toBranded<SceneId>(id)),
    },
  };
}
