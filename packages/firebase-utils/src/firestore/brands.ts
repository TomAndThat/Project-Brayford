/**
 * Brand Firestore Operations
 * Organization Domain - Phase 1
 * 
 * CRUD operations for brands collection
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
  serverTimestamp,
  type DocumentReference,
} from 'firebase/firestore';
import { db } from '../config';
import { createConverter, convertFromFirestore } from './converters';
import {
  validateBrandData,
  validateUpdateBrandData,
  type Brand,
  type BrandDocument,
  type CreateBrandData,
  type UpdateBrandData,
  toBranded,
  fromBranded,
  type BrandId,
  type OrganizationId,
} from '@brayford/core';

/**
 * Firestore converter for Brand documents
 */
const brandConverter = createConverter(validateBrandData, ['createdAt']);

/**
 * Get reference to a brand document
 */
export function getBrandRef(brandId: BrandId): DocumentReference<Brand> {
  return doc(db, 'brands', fromBranded(brandId)).withConverter(brandConverter);
}

/**
 * Get brand by ID
 * 
 * @param brandId - Brand ID (branded type)
 * @returns Brand document or null if not found
 * 
 * @example
 * ```ts
 * const brand = await getBrand(brandId);
 * if (brand) {
 *   console.log(brand.name);
 * }
 * ```
 */
export async function getBrand(brandId: BrandId): Promise<BrandDocument | null> {
  const brandRef = getBrandRef(brandId);
  const brandSnap = await getDoc(brandRef);
  
  if (!brandSnap.exists()) {
    return null;
  }
  
  const data = brandSnap.data();
  return {
    id: brandId,
    ...data,
    organizationId: toBranded<OrganizationId>(data.organizationId),
  };
}

/**
 * Create new brand
 * 
 * @param data - Brand creation data
 * @returns ID of newly created brand
 * 
 * @example
 * ```ts
 * const brandId = await createBrand({
 *   organizationId: orgId,
 *   name: 'The Example Podcast',
 *   logo: 'https://...',
 *   description: 'A great podcast',
 * });
 * ```
 */
export async function createBrand(data: CreateBrandData): Promise<BrandId> {
  const brandRef = doc(collection(db, 'brands'));
  const brandId = toBranded<BrandId>(brandRef.id);
  
  await setDoc(brandRef, {
    ...data,
    createdAt: serverTimestamp(),
    isActive: true,
  });
  
  return brandId;
}

/**
 * Update brand
 * 
 * @param brandId - Brand ID (branded type)
 * @param data - Partial brand data to update
 * 
 * @example
 * ```ts
 * await updateBrand(brandId, {
 *   name: 'Updated Podcast Name',
 *   logo: 'https://new-logo.png',
 * });
 * ```
 */
export async function updateBrand(
  brandId: BrandId,
  data: UpdateBrandData
): Promise<void> {
  const validatedData = validateUpdateBrandData(data);
  const brandRef = doc(db, 'brands', fromBranded(brandId));
  await updateDoc(brandRef, validatedData);
}

/**
 * Delete brand (soft delete)
 * Sets isActive to false instead of removing document
 * 
 * @param brandId - Brand ID (branded type)
 * 
 * @example
 * ```ts
 * await deleteBrand(brandId); // Soft delete
 * ```
 */
export async function deleteBrand(brandId: BrandId): Promise<void> {
  await updateBrand(brandId, { isActive: false });
}

/**
 * Permanently delete brand
 * 
 * WARNING: This removes the document entirely.
 * Consider using deleteBrand() for soft-deletion instead.
 * 
 * @param brandId - Brand ID (branded type)
 */
export async function permanentlyDeleteBrand(brandId: BrandId): Promise<void> {
  const brandRef = doc(db, 'brands', fromBranded(brandId));
  await deleteDoc(brandRef);
}

/**
 * Get all brands for an organization
 * Optionally filter to only active brands
 * 
 * @param organizationId - Organization ID
 * @param activeOnly - If true, only return brands where isActive = true
 * @returns Array of brand documents
 * 
 * @example
 * ```ts
 * // Get all brands (including archived)
 * const allBrands = await getOrganizationBrands(orgId, false);
 * 
 * // Get only active brands
 * const activeBrands = await getOrganizationBrands(orgId, true);
 * ```
 */
export async function getOrganizationBrands(
  organizationId: OrganizationId,
  activeOnly: boolean = true
): Promise<BrandDocument[]> {
  let brandsQuery = query(
    collection(db, 'brands'),
    where('organizationId', '==', fromBranded(organizationId))
  );
  
  if (activeOnly) {
    brandsQuery = query(brandsQuery, where('isActive', '==', true));
  }
  
  const querySnap = await getDocs(brandsQuery);
  
  return querySnap.docs.map((doc) => {
    const data = convertFromFirestore(doc.data(), validateBrandData, ['createdAt']);
    
    return {
      id: toBranded<BrandId>(doc.id),
      ...data,
      organizationId: toBranded<OrganizationId>(data.organizationId),
    };
  });
}

/**
 * Check if brand exists
 * 
 * @param brandId - Brand ID (branded type)
 * @returns True if brand document exists
 */
export async function brandExists(brandId: BrandId): Promise<boolean> {
  const brandRef = getBrandRef(brandId);
  const brandSnap = await getDoc(brandRef);
  return brandSnap.exists();
}
