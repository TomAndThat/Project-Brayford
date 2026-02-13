/**
 * POST /api/images/upload
 *
 * Initiate an image upload to the organization's image library.
 * Creates a Firestore document with uploadStatus: 'pending' and returns
 * the imageId and storagePath for client-side upload via Firebase SDK.
 *
 * Requires images:upload permission.
 *
 * Request body: {
 *   organizationId: string,
 *   name: string,
 *   description?: string,
 *   tags?: string[],
 *   filename: string,
 *   contentType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
 *   sizeBytes: number,
 *   dimensions: { width: number, height: number }
 * }
 *
 * Response:
 * 201: { imageId: string, storagePath: string, image: object }
 * 400: { error: string }
 * 401: { error: string }
 * 403: { error: string }
 * 500: { error: string }
 *
 * Authorization: Bearer <Firebase ID Token>
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { authenticateRequest } from '@/lib/api-auth';
import {
  hasPermission,
  IMAGES_UPLOAD,
  validateCreateImageData,
  deduplicateImageName,
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_SIZE_BYTES,
} from '@brayford/core';
import type { OrganizationMember } from '@brayford/core';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Authenticate
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    const { uid } = auth;

    // 2. Parse and validate body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 },
      );
    }

    // Inject createdBy from auth token
    const bodyWithCreator = { ...(body as Record<string, unknown>), createdBy: uid };

    let validatedData;
    try {
      validatedData = validateCreateImageData(bodyWithCreator);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid image data', details: String(error) },
        { status: 400 },
      );
    }

    const { organizationId } = validatedData;

    // 3. Verify org membership + permission
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

    if (!hasPermission(actorMember, IMAGES_UPLOAD)) {
      return NextResponse.json(
        { error: 'You do not have permission to upload images' },
        { status: 403 },
      );
    }

    // 4. Deduplicate name
    const existingNamesSnap = await adminDb
      .collection('images')
      .where('organizationId', '==', organizationId)
      .where('isActive', '==', true)
      .select('name')
      .get();

    const existingNames = existingNamesSnap.docs.map((doc) => doc.data().name as string);
    const deduplicatedName = deduplicateImageName(validatedData.name, existingNames);

    // 5. Generate image document
    const imageRef = adminDb.collection('images').doc();
    const imageId = imageRef.id;
    const storagePath = `images/${organizationId}/${imageId}/${validatedData.filename}`;

    const imageDoc = {
      organizationId: validatedData.organizationId,
      name: deduplicatedName,
      description: validatedData.description || '',
      tags: validatedData.tags || [],
      storagePath,
      url: '', // Will be set on confirm
      filename: validatedData.filename,
      contentType: validatedData.contentType,
      sizeBytes: validatedData.sizeBytes,
      dimensions: validatedData.dimensions,
      uploadStatus: 'pending',
      usageCount: 0,
      usedBy: { brands: [], scenes: [] },
      createdAt: FieldValue.serverTimestamp(),
      createdBy: uid,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
      isActive: true,
    };

    await imageRef.set(imageDoc);

    return NextResponse.json(
      {
        imageId,
        storagePath,
        image: {
          ...imageDoc,
          id: imageId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Image upload initiation failed:', error);
    return NextResponse.json(
      { error: 'Failed to initiate image upload' },
      { status: 500 },
    );
  }
}
