/**
 * GET /api/images
 *
 * List images for an organization.
 * Requires images:view permission.
 *
 * Query params:
 *   organizationId (required) — Organization to list images for
 *   tag (optional) — Filter by tag
 *   uploadStatus (optional, default: 'processed') — Filter by upload status
 *
 * Response:
 * 200: { images: object[] }
 * 400: { error: string }
 * 401: { error: string }
 * 403: { error: string }
 * 500: { error: string }
 *
 * Authorization: Bearer <Firebase ID Token>
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { authenticateRequest } from '@/lib/api-auth';
import {
  hasPermission,
  IMAGES_VIEW,
} from '@brayford/core';
import type { OrganizationMember, ImageUploadStatus } from '@brayford/core';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Authenticate
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    const { uid } = auth;

    // 2. Parse query params
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const tag = searchParams.get('tag');
    const uploadStatus = (searchParams.get('uploadStatus') || 'processed') as ImageUploadStatus;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: organizationId' },
        { status: 400 },
      );
    }

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

    if (!hasPermission(actorMember, IMAGES_VIEW)) {
      return NextResponse.json(
        { error: 'You do not have permission to view images' },
        { status: 403 },
      );
    }

    // 4. Query images
    let imagesQuery = adminDb
      .collection('images')
      .where('organizationId', '==', organizationId)
      .where('isActive', '==', true)
      .where('uploadStatus', '==', uploadStatus)
      .orderBy('createdAt', 'desc');

    const imagesSnap = await imagesQuery.get();

    let images: Record<string, unknown>[] = imagesSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
    }));

    // 5. Client-side tag filter
    if (tag) {
      const tagLower = tag.toLowerCase();
      images = images.filter((img) => {
        const imgTags = (img.tags as string[]) || [];
        return imgTags.some((t) => t.toLowerCase() === tagLower);
      });
    }

    return NextResponse.json({ images }, { status: 200 });
  } catch (error) {
    console.error('Error fetching images:', error);
    return NextResponse.json(
      { error: 'Failed to fetch images' },
      { status: 500 },
    );
  }
}
