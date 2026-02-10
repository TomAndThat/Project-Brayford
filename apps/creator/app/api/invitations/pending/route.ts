/**
 * GET /api/invitations/pending
 * 
 * Authenticated endpoint for fetching all pending invitations for the current user's email.
 * 
 * This endpoint requires authentication because:
 * 1. It returns all invitations for a given email (privacy sensitive)
 * 2. Must verify the requester owns the email address
 * 3. Uses Admin SDK to bypass Firestore security rules
 * 
 * Authorization: Bearer <Firebase ID Token>
 * 
 * Response:
 * 200: { invitations: InvitationDocument[] }
 * 401: { error: string }
 * 500: { error: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Verify authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const idToken = authHeader.slice(7);
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json(
        { error: 'Invalid or expired authentication token' },
        { status: 401 }
      );
    }

    const userEmail = decodedToken.email;

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User account has no email address' },
        { status: 400 }
      );
    }

    // 2. Query pending invitations for this email
    const normalizedEmail = userEmail.toLowerCase().trim();
    const invitationsRef = adminDb.collection('invitations');
    const querySnapshot = await invitationsRef
      .where('email', '==', normalizedEmail)
      .where('status', '==', 'pending')
      .get();

    // 3. Transform results
    const invitations = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        invitedAt: data.invitedAt?.toDate().toISOString(),
        expiresAt: data.expiresAt?.toDate().toISOString(),
        acceptedAt: data.acceptedAt?.toDate().toISOString(),
      };
    });

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error('Error fetching pending invitations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending invitations' },
      { status: 500 }
    );
  }
}
