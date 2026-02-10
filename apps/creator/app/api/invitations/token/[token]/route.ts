/**
 * GET /api/invitations/token/[token]
 * 
 * Public endpoint for fetching invitation details by token.
 * 
 * This endpoint allows UNAUTHENTICATED access because:
 * 1. Users need to see invitation details before deciding to sign in/accept
 * 2. Tokens are securely generated UUIDs (low collision risk)
 * 3. No sensitive data is exposed (just org name, role, inviter name)
 * 4. Uses Admin SDK to bypass Firestore security rules
 * 
 * Path parameter:
 *   token: string - The invitation token (UUID from email link)
 * 
 * Response:
 * 200: { invitation: InvitationDocument }
 * 404: { error: "Invitation not found" }
 * 500: { error: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  try {
    const { token } = await params;

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Invalid token parameter' },
        { status: 400 }
      );
    }

    // Query Firestore using Admin SDK (bypasses security rules)
    const invitationsRef = adminDb.collection('invitations');
    const querySnapshot = await invitationsRef
      .where('token', '==', token)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    const doc = querySnapshot.docs[0]!;
    const data = doc.data();

    // Transform Firestore Timestamps to ISO strings for JSON serialization
    const invitation = {
      id: doc.id,
      ...data,
      invitedAt: data.invitedAt?.toDate().toISOString(),
      expiresAt: data.expiresAt?.toDate().toISOString(),
      acceptedAt: data.acceptedAt?.toDate().toISOString(),
    };

    return NextResponse.json({ invitation });
  } catch (error) {
    console.error('Error fetching invitation by token:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invitation' },
      { status: 500 }
    );
  }
}
