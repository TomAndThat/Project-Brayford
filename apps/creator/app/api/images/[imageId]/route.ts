/**
 * PATCH  /api/images/[imageId] — Update image metadata
 * DELETE /api/images/[imageId] — Delete image
 *
 * PATCH: Requires images:update permission. Updates name, description, tags.
 * DELETE: Requires images:delete permission. Checks usageCount before deletion.
 *
 * Authorization: Bearer <Firebase ID Token>
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
  IMAGES_UPDATE,
  IMAGES_DELETE,
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
 * DELETE /api/images/[imageId]
 *
 * Delete an image. Checks usageCount — if > 0, returns 409 Conflict
 * with the usedBy details so the frontend can show where it's referenced.
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const { imageId } = await params;

    const result = await verifyImagePermission(request, imageId, IMAGES_DELETE);
    if (result.error) return result.error;

    const { imageRef, imageData } = result;

    // Check usage count — prevent deletion if image is in use
    const usageCount = (imageData.usageCount as number) || 0;
    if (usageCount > 0) {
      return NextResponse.json(
        {
          error: 'This image is currently in use and cannot be deleted.',
          usedBy: imageData.usedBy || { brands: [], scenes: [] },
        },
        { status: 409 },
      );
    }

    // Delete from Storage
    try {
      const bucket = getStorage().bucket();
      const file = bucket.file(imageData.storagePath);
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

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Image deletion failed:', error);
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 },
    );
  }
}
