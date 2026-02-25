/**
 * GET    /api/images/[imageId] — Fetch a single image
 * PATCH  /api/images/[imageId] — Update image metadata
 * DELETE /api/images/[imageId] — Delete image
 *
 * GET:    Requires images:view permission. Returns the image document.
 * PATCH:  Requires images:update permission. Updates name, description, tags.
 * DELETE: Requires images:delete permission. Performs live Firestore queries to
 *         find active references before allowing deletion.
 *
 * Authorization: Bearer <Firebase ID Token>
 *
 * GET Response:
 * 200: { image: object }
 * 401: { error: string }
 * 403: { error: string }
 * 404: { error: string }
 * 500: { error: string }
 *
 * PATCH Response:
 * 200: { image: object }
 * 400: { error: string }
 * 401: { error: string }
 * 403: { error: string }
 * 404: { error: string }
 * 500: { error: string }
 *
 * DELETE Response:
 * 204: (no content)
 * 401: { error: string }
 * 403: { error: string }
 * 404: { error: string }
 * 409: { error: string, usedBy: object }
 * 500: { error: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { authenticateRequest } from '@/lib/api-auth';
import {
  hasPermission,
  IMAGES_VIEW,
  IMAGES_UPDATE,
  IMAGES_DELETE,
  BRANDS_UPDATE,
  EVENTS_MANAGE_MODULES,
  validateUpdateImageMetadataData,
  deduplicateImageName,
} from '@brayford/core';
import type { OrganizationMember, Permission } from '@brayford/core';

type RouteParams = {
  params: Promise<{ imageId: string }>;
};

/**
 * Helper: fetch image and verify caller has the required permission
 */
async function verifyImagePermission(
  request: NextRequest,
  imageId: string,
  requiredPermission: Permission,
): Promise<
  | { error: NextResponse }
  | {
      error: null;
      imageRef: FirebaseFirestore.DocumentReference;
      imageData: FirebaseFirestore.DocumentData;
      uid: string;
    }
> {
  const auth = await authenticateRequest(request);
  if (auth.error) return { error: auth.error };
  const { uid } = auth;

  const imageRef = adminDb.collection('images').doc(imageId);
  const imageDoc = await imageRef.get();

  if (!imageDoc.exists) {
    return {
      error: NextResponse.json(
        { error: 'Image not found' },
        { status: 404 },
      ),
    };
  }

  const imageData = imageDoc.data()!;

  // Verify org membership + permission
  const memberQuery = await adminDb
    .collection('organizationMembers')
    .where('organizationId', '==', imageData.organizationId)
    .where('userId', '==', uid)
    .limit(1)
    .get();

  if (memberQuery.empty) {
    return {
      error: NextResponse.json(
        { error: 'You are not a member of this organisation' },
        { status: 403 },
      ),
    };
  }

  const memberData = memberQuery.docs[0]!.data();
  const actorMember = {
    organizationId: memberData.organizationId,
    userId: memberData.userId,
    role: memberData.role,
    permissions: memberData.permissions || [],
    brandAccess: memberData.brandAccess || [],
  } as OrganizationMember;

  if (!hasPermission(actorMember, requiredPermission)) {
    return {
      error: NextResponse.json(
        { error: 'You do not have the required permission' },
        { status: 403 },
      ),
    };
  }

  return { error: null, imageRef, imageData, uid };
}

/**
 * GET /api/images/[imageId]
 *
 * Fetch a single image by ID. Requires images:view permission.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const { imageId } = await params;

    const result = await verifyImagePermission(request, imageId, IMAGES_VIEW);
    if (result.error) return result.error;

    const { imageData } = result;

    return NextResponse.json(
      {
        image: {
          id: imageId,
          ...imageData,
          createdAt: imageData.createdAt?.toDate?.()?.toISOString() || imageData.createdAt,
          updatedAt: imageData.updatedAt?.toDate?.()?.toISOString() || imageData.updatedAt,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error fetching image:', error);
    return NextResponse.json(
      { error: 'Failed to fetch image' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/images/[imageId]
 *
 * Update image metadata (name, description, tags).
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const { imageId } = await params;

    const result = await verifyImagePermission(request, imageId, IMAGES_UPDATE);
    if (result.error) return result.error;

    const { imageRef, imageData, uid } = result;

    // Parse and validate body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 },
      );
    }

    // Inject updatedBy from auth
    const bodyWithUpdater = { ...(body as Record<string, unknown>), updatedBy: uid };

    let validatedData;
    try {
      validatedData = validateUpdateImageMetadataData(bodyWithUpdater);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid update data', details: String(error) },
        { status: 400 },
      );
    }

    // If name changed, deduplicate
    if (validatedData.name && validatedData.name !== imageData.name) {
      const existingNamesSnap = await adminDb
        .collection('images')
        .where('organizationId', '==', imageData.organizationId)
        .where('isActive', '==', true)
        .select('name')
        .get();

      const existingNames = existingNamesSnap.docs
        .filter((doc) => doc.id !== imageId)
        .map((doc) => doc.data().name as string);

      validatedData = {
        ...validatedData,
        name: deduplicateImageName(validatedData.name, existingNames),
      };
    }

    // Strip undefined values
    const cleanData = Object.fromEntries(
      Object.entries(validatedData).filter(([, v]) => v !== undefined),
    );

    await imageRef.update({
      ...cleanData,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Return updated image
    const updatedSnap = await imageRef.get();
    const updatedData = updatedSnap.data()!;

    return NextResponse.json(
      {
        image: {
          id: imageId,
          ...updatedData,
          createdAt: updatedData.createdAt?.toDate?.()?.toISOString() || updatedData.createdAt,
          updatedAt: updatedData.updatedAt?.toDate?.()?.toISOString() || updatedData.updatedAt,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Image metadata update failed:', error);
    return NextResponse.json(
      { error: 'Failed to update image metadata' },
      { status: 500 },
    );
  }
}

/**
 * Perform a live query to find all brand documents that reference the given imageId
 * in any of their styling image fields.
 *
 * Runs 4 parallel Firestore queries (one per image field) and deduplicates results.
 * This is the source of truth — never rely on the async-cached usedBy/usageCount fields
 * for destructive operations.
 */
async function findBrandReferencesLive(
  imageId: string,
  organizationId: string,
): Promise<string[]> {
  const stylingFields = [
    'styling.profileImageId',
    'styling.logoImageId',
    'styling.bannerImageId',
    'styling.headerBackgroundImageId',
  ] as const;

  const queries = stylingFields.map((field) =>
    adminDb
      .collection('brands')
      .where('organizationId', '==', organizationId)
      .where(field, '==', imageId)
      .select() // Only need document IDs
      .get(),
  );

  const results = await Promise.all(queries);
  const brandIds = new Set<string>();

  for (const snapshot of results) {
    for (const doc of snapshot.docs) {
      brandIds.add(doc.id);
    }
  }

  return Array.from(brandIds);
}

/**
 * Recursively collect all string values from a nested object/array structure.
 * Used to scan scene module configs for image URLs.
 */
function collectStringValues(obj: unknown): string[] {
  if (typeof obj === 'string') return [obj];
  if (Array.isArray(obj)) return obj.flatMap(collectStringValues);
  if (obj && typeof obj === 'object') {
    return Object.values(obj as Record<string, unknown>).flatMap(collectStringValues);
  }
  return [];
}

/**
 * Perform a live query to find all scene documents that reference the given image
 * in their module configs.
 *
 * Scenes store image references as URLs containing the image's storagePath within
 * nested module config objects. Firestore cannot query these directly, so we fetch
 * all scenes for the organisation and scan in code.
 */
async function findSceneReferencesLive(
  imageId: string,
  storagePath: string,
  organizationId: string,
): Promise<string[]> {
  const scenesSnapshot = await adminDb
    .collection('scenes')
    .where('organizationId', '==', organizationId)
    .get();

  // Firebase Storage URLs encode paths with %2F — check both forms
  const encodedStoragePath = storagePath
    .split('/')
    .map(encodeURIComponent)
    .join('%2F');

  const sceneIds: string[] = [];

  for (const doc of scenesSnapshot.docs) {
    const modules = doc.data().modules;
    if (!Array.isArray(modules)) continue;

    let found = false;
    for (const mod of modules) {
      if (!mod?.config) continue;

      const strings = collectStringValues(mod.config);
      for (const str of strings) {
        if (
          str.includes(storagePath) ||
          str.includes(encodedStoragePath) ||
          str.includes(imageId)
        ) {
          found = true;
          break;
        }
      }
      if (found) break;
    }

    if (found) {
      sceneIds.push(doc.id);
    }
  }

  return sceneIds;
}

/**
 * DELETE /api/images/[imageId]?force=true
 *
 * Delete an image. Performs live Firestore queries to find all entities that
 * reference this image. If references exist, either returns 409 Conflict
 * or performs cascade deletion based on ?force query parameter.
 *
 * Without ?force=true:
 * - Returns 409 with usedBy details and live event warnings
 *
 * With ?force=true:
 * - Verifies user has update permissions for all affected brands/scenes
 * - Removes image references from all entities
 * - Deletes the image
 * - Returns summary of affected entities
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const { imageId } = await params;
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    const result = await verifyImagePermission(request, imageId, IMAGES_DELETE);
    if (result.error) return result.error;

    const { imageRef, imageData, uid } = result;

    const organizationId = imageData.organizationId as string;
    const storagePath = imageData.storagePath as string;

    // Live query: find ALL entities that actually reference this image right now.
    // Never rely on the async-cached usageCount/usedBy fields for destructive operations.
    const [affectedBrandIds, affectedSceneIds] = await Promise.all([
      findBrandReferencesLive(imageId, organizationId),
      findSceneReferencesLive(imageId, storagePath, organizationId),
    ]);

    const usedByLive = {
      brands: affectedBrandIds,
      scenes: affectedSceneIds,
    };

    const totalReferences = usedByLive.brands.length + usedByLive.scenes.length;

    if (totalReferences > 0) {
      // If not forcing, return conflict with details so the frontend can show the cascade modal
      if (!force) {
        // Check if any affected brands are in live events
        const liveEventWarnings: string[] = [];

        if (usedByLive.brands.length > 0) {
          // Firestore 'in' queries support up to 30 values
          const brandBatches: string[][] = [];
          for (let i = 0; i < usedByLive.brands.length; i += 30) {
            brandBatches.push(usedByLive.brands.slice(i, i + 30));
          }

          const liveEventQueries = brandBatches.map((batch) =>
            adminDb
              .collection('events')
              .where('brandId', 'in', batch)
              .where('status', '==', 'live')
              .get(),
          );

          const liveEventResults = await Promise.all(liveEventQueries);
          let liveEventCount = 0;
          for (const snap of liveEventResults) {
            liveEventCount += snap.size;
          }

          if (liveEventCount > 0) {
            liveEventWarnings.push(
              `⚠️ ${liveEventCount} ${liveEventCount === 1 ? 'brand is' : 'brands are'} currently in live events`,
            );
          }
        }

        return NextResponse.json(
          {
            error: 'This image is currently in use and cannot be deleted.',
            usedBy: usedByLive,
            liveEventWarnings,
          },
          { status: 409 },
        );
      }

      // Force deletion: verify permissions and perform cascade deletion

      // Get user's organization membership for permission checks
      const memberQuery = await adminDb
        .collection('organizationMembers')
        .where('organizationId', '==', organizationId)
        .where('userId', '==', uid)
        .limit(1)
        .get();

      if (memberQuery.empty) {
        return NextResponse.json(
          { error: 'You are not a member of this organisation' },
          { status: 403 },
        );
      }

      const memberData = memberQuery.docs[0]!.data();
      const actorMember = {
        organizationId: memberData.organizationId,
        userId: memberData.userId,
        role: memberData.role,
        permissions: memberData.permissions || [],
        brandAccess: memberData.brandAccess || [],
      } as OrganizationMember;

      // Check if user has brands:update permission for affected brands
      if (usedByLive.brands.length > 0 && !hasPermission(actorMember, BRANDS_UPDATE)) {
        return NextResponse.json(
          { error: 'You do not have permission to update the brands using this image' },
          { status: 403 },
        );
      }

      // Check if user has events:manage_modules permission for affected scenes
      if (usedByLive.scenes.length > 0 && !hasPermission(actorMember, EVENTS_MANAGE_MODULES)) {
        return NextResponse.json(
          { error: 'You do not have permission to update the scenes using this image' },
          { status: 403 },
        );
      }

      // Perform cascade deletion: remove image references from all entities
      const updatePromises: Promise<void>[] = [];

      // Update brands
      for (const brandId of usedByLive.brands) {
        const brandRef = adminDb.collection('brands').doc(brandId);
        updatePromises.push(
          brandRef.get().then(async (brandDoc) => {
            if (!brandDoc.exists) return;

            const brandData = brandDoc.data();
            const styling = (brandData?.styling || {}) as Record<string, unknown>;
            const updates: Record<string, null> = {};

            // Check each image field and clear if it matches this imageId
            if (styling.profileImageId === imageId) {
              updates['styling.profileImageId'] = null;
              updates['styling.profileImageUrl'] = null;
            }
            if (styling.logoImageId === imageId) {
              updates['styling.logoImageId'] = null;
              updates['styling.logoImageUrl'] = null;
            }
            if (styling.bannerImageId === imageId) {
              updates['styling.bannerImageId'] = null;
              updates['styling.bannerImageUrl'] = null;
            }
            if (styling.headerBackgroundImageId === imageId) {
              updates['styling.headerBackgroundImageId'] = null;
              updates['styling.headerBackgroundImageUrl'] = null;
            }

            if (Object.keys(updates).length > 0) {
              await brandRef.update(updates);
            }
          }),
        );
      }

      // Update scenes (scan module configs for image references)
      for (const sceneId of usedByLive.scenes) {
        const sceneRef = adminDb.collection('scenes').doc(sceneId);
        updatePromises.push(
          sceneRef.get().then(async (sceneDoc) => {
            if (!sceneDoc.exists) return;

            const sceneData = sceneDoc.data();
            const modules = sceneData?.modules as Array<Record<string, unknown>> | undefined;

            if (!modules || !Array.isArray(modules)) return;

            // Deep scan and replace image URLs in module configs
            let hasChanges = false;
            const updatedModules = modules.map((mod) => {
              const config = mod.config as Record<string, unknown> | undefined;
              if (!config) return mod;

              const updatedConfig = replaceImageReferencesInConfig(
                config,
                storagePath,
              );

              if (updatedConfig !== config) {
                hasChanges = true;
                return { ...mod, config: updatedConfig };
              }

              return mod;
            });

            if (hasChanges) {
              await sceneRef.update({ modules: updatedModules });
            }
          }),
        );
      }

      // Wait for all updates to complete
      await Promise.allSettled(updatePromises);
    }

    // Delete from Storage
    try {
      const bucket = getStorage().bucket();
      const file = bucket.file(storagePath);
      await file.delete();
    } catch (storageError: unknown) {
      // Ignore "not found" — file may have already been deleted
      if (
        storageError instanceof Error &&
        'code' in storageError &&
        (storageError as { code: number }).code === 404
      ) {
        // Already deleted, continue
      } else {
        console.error('Storage deletion failed:', storageError);
        // Continue with Firestore deletion even if storage deletion fails
      }
    }

    // Delete Firestore document
    await imageRef.delete();

    // Return success with summary
    if (totalReferences > 0) {
      return NextResponse.json({
        success: true,
        removed: {
          brands: usedByLive.brands.length,
          scenes: usedByLive.scenes.length,
        },
      });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Image deletion failed:', error);
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 },
    );
  }
}

/**
 * Recursively replace image references in scene module configs.
 * Returns a new config object if changes were made, or the original if unchanged.
 */
function replaceImageReferencesInConfig(
  config: Record<string, unknown>,
  targetStoragePath: string,
): Record<string, unknown> {
  let hasChanges = false;
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'string' && value.includes(targetStoragePath)) {
      result[key] = null;
      hasChanges = true;
    } else if (Array.isArray(value)) {
      const updatedArray = value.map((item) => {
        if (typeof item === 'string' && item.includes(targetStoragePath)) {
          hasChanges = true;
          return null;
        }
        if (item && typeof item === 'object') {
          const updated = replaceImageReferencesInConfig(
            item as Record<string, unknown>,
            targetStoragePath,
          );
          if (updated !== item) hasChanges = true;
          return updated;
        }
        return item;
      });
      result[key] = updatedArray;
    } else if (value && typeof value === 'object') {
      const updated = replaceImageReferencesInConfig(
        value as Record<string, unknown>,
        targetStoragePath,
      );
      result[key] = updated;
      if (updated !== value) hasChanges = true;
    } else {
      result[key] = value;
    }
  }

  return hasChanges ? result : config;
}
