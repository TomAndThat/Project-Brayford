/**
 * Scene Firestore Operations
 * Interaction Domain
 * 
 * CRUD operations for the scenes collection.
 * Scenes define what content appears on audience devices.
 * 
 * Three-tier hierarchy:
 * - Org-wide: brandId = null, eventId = null
 * - Brand-specific: brandId set, eventId = null
 * - Event-specific: brandId set, eventId set
 * 
 * @see docs/briefs/SCENE_SYSTEM.md
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
import { createConverter } from './converters';
import {
  validateSceneData,
  type Scene,
  type SceneDocument,
  type CreateSceneData,
  type UpdateSceneData,
  toBranded,
  fromBranded,
  type SceneId,
  type BrandId,
  type EventId,
  type OrganizationId,
  type UserId,
} from '@brayford/core';

/**
 * Firestore converter for Scene documents
 */
const sceneConverter = createConverter(validateSceneData, ['createdAt', 'updatedAt']);

/**
 * Get reference to a scene document
 */
export function getSceneRef(sceneId: SceneId): DocumentReference<Scene> {
  return doc(db, 'scenes', fromBranded(sceneId)).withConverter(sceneConverter);
}

/**
 * Get scene by ID
 * 
 * @param sceneId - Scene ID (branded type)
 * @returns Scene document or null if not found
 * 
 * @example
 * ```ts
 * const scene = await getScene(sceneId);
 * if (scene) {
 *   console.log(scene.name, scene.modules.length);
 * }
 * ```
 */
export async function getScene(sceneId: SceneId): Promise<SceneDocument | null> {
  const sceneRef = getSceneRef(sceneId);
  const sceneSnap = await getDoc(sceneRef);
  
  if (!sceneSnap.exists()) {
    return null;
  }
  
  const data = sceneSnap.data();
  return {
    id: sceneId,
    ...data,
    organizationId: toBranded<OrganizationId>(data.organizationId),
    brandId: data.brandId ? toBranded<BrandId>(data.brandId) : null,
    eventId: data.eventId ? toBranded<EventId>(data.eventId) : null,
    createdBy: toBranded<UserId>(data.createdBy),
  };
}

/**
 * Create a new scene
 * 
 * @param data - Scene creation data
 * @returns ID of newly created scene
 * 
 * @example
 * ```ts
 * const sceneId = await createScene({
 *   eventId: fromBranded(eventId),
 *   organizationId: fromBranded(orgId),
 *   name: 'Welcome Screen',
 *   createdBy: fromBranded(userId),
 *   modules: [],
 * });
 * ```
 */
export async function createScene(data: CreateSceneData): Promise<SceneId> {
  const sceneRef = doc(collection(db, 'scenes'));
  const sceneId = toBranded<SceneId>(sceneRef.id);
  
  // Strip undefined values — Firestore rejects them
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  );

  await setDoc(sceneRef, {
    ...cleanData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  
  return sceneId;
}

/**
 * Update an existing scene
 * 
 * @param sceneId - Scene ID to update
 * @param data - Partial scene data to update
 * 
 * @example
 * ```ts
 * await updateScene(sceneId, {
 *   name: 'Updated Welcome',
 *   modules: [...updatedModules],
 * });
 * ```
 */
export async function updateScene(
  sceneId: SceneId,
  data: UpdateSceneData
): Promise<void> {
  const sceneRef = getSceneRef(sceneId);
  
  // Strip undefined values
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  );
  
  await updateDoc(sceneRef, {
    ...cleanData,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a scene
 * 
 * @param sceneId - Scene ID to delete
 * 
 * @example
 * ```ts
 * await deleteScene(sceneId);
 * ```
 */
export async function deleteScene(sceneId: SceneId): Promise<void> {
  const sceneRef = doc(db, 'scenes', fromBranded(sceneId));
  await deleteDoc(sceneRef);
}

/**
 * Get all scenes for an event
 * 
 * @param eventId - Event ID
 * @returns Array of scene documents, ordered by creation date
 * 
 * @example
 * ```ts
 * const scenes = await getEventScenes(eventId);
 * scenes.forEach(s => console.log(s.name));
 * ```
 */
export async function getEventScenes(eventId: EventId): Promise<SceneDocument[]> {
  const scenesRef = collection(db, 'scenes');
  const q = query(
    scenesRef,
    where('eventId', '==', fromBranded(eventId)),
    orderBy('createdAt', 'asc')
  );
  
  const querySnap = await getDocs(q);
  
  const scenes: SceneDocument[] = [];
  for (const docSnap of querySnap.docs) {
    const data = validateSceneData({
      ...docSnap.data(),
      createdAt: docSnap.data().createdAt?.toDate(),
      updatedAt: docSnap.data().updatedAt?.toDate(),
    });
    
    scenes.push({
      id: toBranded<SceneId>(docSnap.id),
      ...data,
      organizationId: toBranded<OrganizationId>(data.organizationId),
      brandId: data.brandId ? toBranded<BrandId>(data.brandId) : null,
      eventId: data.eventId ? toBranded<EventId>(data.eventId) : null,
      createdBy: toBranded<UserId>(data.createdBy),
    });
  }
  
  return scenes;
}

/**
 * Get all scenes for a brand (brand-scoped scenes only, not event-specific)
 * 
 * @param brandId - Brand ID
 * @returns Array of brand-scoped scene documents
 * 
 * @example
 * ```ts
 * const brandScenes = await getBrandScenes(brandId);
 * ```
 */
export async function getBrandScenes(
  brandId: BrandId
): Promise<SceneDocument[]> {
  const scenesRef = collection(db, 'scenes');
  const q = query(
    scenesRef,
    where('brandId', '==', fromBranded(brandId)),
    where('eventId', '==', null),
    orderBy('createdAt', 'asc')
  );
  
  const querySnap = await getDocs(q);
  
  const scenes: SceneDocument[] = [];
  for (const docSnap of querySnap.docs) {
    const data = validateSceneData({
      ...docSnap.data(),
      createdAt: docSnap.data().createdAt?.toDate(),
      updatedAt: docSnap.data().updatedAt?.toDate(),
    });
    
    scenes.push({
      id: toBranded<SceneId>(docSnap.id),
      ...data,
      organizationId: toBranded<OrganizationId>(data.organizationId),
      brandId: toBranded<BrandId>(data.brandId!),
      eventId: null,
      createdBy: toBranded<UserId>(data.createdBy),
    });
  }
  
  return scenes;
}

/**
 * Get all org-wide scenes (no brand or event assigned)
 * 
 * @param organizationId - Organization ID
 * @returns Array of org-wide scene documents
 * 
 * @example
 * ```ts
 * const orgScenes = await getOrganizationScenes(orgId);
 * ```
 */
export async function getOrganizationScenes(
  organizationId: OrganizationId
): Promise<SceneDocument[]> {
  const scenesRef = collection(db, 'scenes');
  const q = query(
    scenesRef,
    where('organizationId', '==', fromBranded(organizationId)),
    where('brandId', '==', null),
    where('eventId', '==', null),
    orderBy('createdAt', 'asc')
  );
  
  const querySnap = await getDocs(q);
  
  const scenes: SceneDocument[] = [];
  for (const docSnap of querySnap.docs) {
    const data = validateSceneData({
      ...docSnap.data(),
      createdAt: docSnap.data().createdAt?.toDate(),
      updatedAt: docSnap.data().updatedAt?.toDate(),
    });
    
    scenes.push({
      id: toBranded<SceneId>(docSnap.id),
      ...data,
      organizationId: toBranded<OrganizationId>(data.organizationId),
      brandId: null,
      eventId: null,
      createdBy: toBranded<UserId>(data.createdBy),
    });
  }
  
  return scenes;
}

/**
 * Duplicate a scene to a new scope
 * 
 * Creates a new scene with the same modules and config as the source,
 * but with a new ID and optionally a different scope (org/brand/event).
 * 
 * @param sceneId - Source scene ID to duplicate
 * @param target - Target scope for the duplicate
 * @param target.brandId - Brand to attach the copy to (null for org-wide)
 * @param target.eventId - Event to attach the copy to (null for brand-wide or org-wide)
 * @param createdBy - User performing the duplication
 * @returns ID of the new duplicated scene
 * 
 * @example
 * ```ts
 * // Copy a scene to a different brand
 * const newSceneId = await duplicateScene(sceneId, { brandId: newBrandId, eventId: null }, userId);
 * 
 * // Copy a scene to a specific event
 * const eventSceneId = await duplicateScene(sceneId, { brandId, eventId }, userId);
 * 
 * // Copy a scene to org-wide
 * const orgSceneId = await duplicateScene(sceneId, { brandId: null, eventId: null }, userId);
 * ```
 */
export async function duplicateScene(
  sceneId: SceneId,
  target: { brandId: BrandId | null; eventId: EventId | null },
  createdBy: UserId
): Promise<SceneId> {
  const source = await getScene(sceneId);
  if (!source) {
    throw new Error(`Scene not found: ${fromBranded(sceneId)}`);
  }
  
  return createScene({
    organizationId: fromBranded(source.organizationId),
    brandId: target.brandId ? fromBranded(target.brandId) : null,
    eventId: target.eventId ? fromBranded(target.eventId) : null,
    name: source.name,
    description: source.description,
    modules: source.modules,
    createdBy: fromBranded(createdBy),
  });
}
