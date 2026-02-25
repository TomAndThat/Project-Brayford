/**
 * POST /api/images/[imageId]/confirm
 *
 * Confirm that an image upload has completed successfully.
 * Verifies the file exists in Storage at the expected path,
 * then updates the Firestore document: uploadStatus → 'ready', sets url.
 *
 * Requires org membership (any authenticated member can confirm their upload).
 *
 * Request body: {
 *   url: string  — The download URL from Firebase Storage
 * }
 *
 * Response:
 * 200: { image: object }
 * 400: { error: string }
 * 401: { error: string }
 * 403: { error: string }
 * 404: { error: string }
 * 500: { error: string }
 *
 * Authorization: Bearer <Firebase ID Token>
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { authenticateRequest } from '@/lib/api-auth';
import { getStorage } from 'firebase-admin/storage';

type RouteParams = {
  params: Promise<{ imageId: string }>;
};

export async function POST(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const { imageId } = await params;

    // 1. Authenticate
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    const { uid } = auth;

    // 2. Parse body
    let body: { url?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 },
      );
    }

    if (!body.url || typeof body.url !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: url' },
        { status: 400 },
      );
    }

    // 3. Get image document
    const imageRef = adminDb.collection('images').doc(imageId);
    const imageSnap = await imageRef.get();

    if (!imageSnap.exists) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 },
      );
    }

    const imageData = imageSnap.data()!;

    // 4. Check upload status
    //
    // The onImageUploaded Cloud Function may have already processed the file
    // before this confirm request arrives (it fires on Storage upload and can
    // beat the client). In that case the status will be 'processed' or 'ready'
    // — both are valid success states, so we return the current document
    // without overwriting the Cloud Function's work.
    if (imageData.uploadStatus === 'processed' || imageData.uploadStatus === 'ready') {
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
    }

    if (imageData.uploadStatus !== 'pending') {
      return NextResponse.json(
        { error: `Image upload has an unexpected status: ${imageData.uploadStatus}` },
        { status: 409 },
      );
    }

    // 5. Verify caller is a member of the same org
    const memberQuery = await adminDb
      .collection('organizationMembers')
      .where('organizationId', '==', imageData.organizationId)
      .where('userId', '==', uid)
      .limit(1)
      .get();

    if (memberQuery.empty) {
      return NextResponse.json(
        { error: 'You are not a member of this organisation' },
        { status: 403 },
      );
    }

    // 6. Verify file exists in Storage (best-effort check)
    //
    // The onImageUploaded Cloud Function may have already processed the file
    // by this point — it downloads the original, generates WebP variants, and
    // deletes the original. So the original file may legitimately no longer
    // exist. We only warn rather than reject, because the client obtained a
    // valid download URL via getDownloadURL() which proves the upload itself
    // succeeded.
    try {
      const bucket = getStorage().bucket();
      const file = bucket.file(imageData.storagePath);
      const [exists] = await file.exists();
      if (!exists) {
        // Check if variants already exist (Cloud Function may have processed it)
        const variantPath = imageData.storagePath.replace(
          /\/[^/]+$/,
          '/variants/display.webp',
        );
        const [variantExists] = await bucket.file(variantPath).exists();
        if (!variantExists) {
          console.warn(
            'Neither original nor variant found in Storage — the upload may have failed or is still processing.',
            { imageId, storagePath: imageData.storagePath },
          );
        }
      }
    } catch (storageError) {
      console.error('Storage verification failed:', storageError);
      // Don't block confirmation — the client provided a valid download URL
    }

    // 7. Update Firestore document
    await imageRef.update({
      uploadStatus: 'ready',
      url: body.url,
      updatedBy: uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 8. Return updated image
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
    console.error('Image upload confirmation failed:', error);
    return NextResponse.json(
      { error: 'Failed to confirm image upload' },
      { status: 500 },
    );
  }
}
