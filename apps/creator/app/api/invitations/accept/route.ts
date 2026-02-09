/**
 * POST /api/invitations/accept
 * 
 * Server-side endpoint for atomically accepting invitations.
 * This must be a server-side operation because:
 * 1. Token verification ensures the request is authentic
 * 2. Batch writes ensure the invitation status and member creation are atomic
 * 3. Email validation prevents a user from accepting another user's invitation
 * 
 * Request body:
 * {
 *   invitationIds: string[]  // IDs of invitations to accept
 * }
 * 
 * Authorization: Bearer <Firebase ID Token>
 * 
 * Response:
 * 200: { accepted: string[], skipped: string[], errors: string[] }
 * 400: { error: string }
 * 401: { error: string }
 * 500: { error: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

interface AcceptResult {
  accepted: string[];
  skipped: string[];
  errors: string[];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
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
    const userId = decodedToken.uid;

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User account has no email address' },
        { status: 400 }
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const { invitationIds } = body as { invitationIds: string[] };

    if (!Array.isArray(invitationIds) || invitationIds.length === 0) {
      return NextResponse.json(
        { error: 'invitationIds must be a non-empty array' },
        { status: 400 }
      );
    }

    // 3. Process each invitation
    const result: AcceptResult = {
      accepted: [],
      skipped: [],
      errors: [],
    };

    for (const invitationId of invitationIds) {
      try {
        await processInvitation(invitationId, userId, userEmail, result);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`${invitationId}: ${message}`);
      }
    }

    // 4. Ensure user document exists (create if new user via Flow B)
    await ensureUserDocument(userId, decodedToken);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Invitation acceptance failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Process a single invitation acceptance atomically
 * Uses a Firestore transaction to ensure consistency
 */
async function processInvitation(
  invitationId: string,
  userId: string,
  userEmail: string,
  result: AcceptResult
): Promise<void> {
  await adminDb.runTransaction(async (transaction) => {
    // Read the invitation
    const invRef = adminDb.collection('invitations').doc(invitationId);
    const invSnap = await transaction.get(invRef);

    if (!invSnap.exists) {
      result.skipped.push(invitationId);
      return;
    }

    const invitation = invSnap.data()!;

    // Validate email match
    if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
      result.errors.push(
        `${invitationId}: Email mismatch — please sign in with ${invitation.email}`
      );
      return;
    }

    // Check status
    if (invitation.status !== 'pending') {
      result.skipped.push(invitationId);
      return;
    }

    // Check expiry
    const expiresAt = invitation.expiresAt instanceof Timestamp
      ? invitation.expiresAt.toDate()
      : new Date(invitation.expiresAt);

    if (expiresAt < new Date()) {
      // Mark as expired
      transaction.update(invRef, { status: 'expired' });
      result.skipped.push(invitationId);
      return;
    }

    // Check if user is already a member of this organization
    const existingMemberQuery = await adminDb
      .collection('organizationMembers')
      .where('organizationId', '==', invitation.organizationId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (!existingMemberQuery.empty) {
      // Already a member — mark invitation as accepted but skip member creation
      transaction.update(invRef, {
        status: 'accepted',
        acceptedAt: FieldValue.serverTimestamp(),
      });
      result.skipped.push(invitationId);
      return;
    }

    // Create organization member document
    const memberRef = adminDb.collection('organizationMembers').doc();
    transaction.set(memberRef, {
      organizationId: invitation.organizationId,
      userId: userId,
      role: invitation.role,
      permissions: null, // Derive from role
      brandAccess: invitation.brandAccess || [],
      autoGrantNewBrands: invitation.autoGrantNewBrands ?? false,
      invitedAt: invitation.invitedAt,
      invitedBy: invitation.invitedBy,
      joinedAt: FieldValue.serverTimestamp(),
    });

    // Mark invitation as accepted
    transaction.update(invRef, {
      status: 'accepted',
      acceptedAt: FieldValue.serverTimestamp(),
    });

    result.accepted.push(invitationId);
  });
}

/**
 * Ensure the user document exists in Firestore
 * Creates it if this is a brand-new user (Flow B — invited before signing up)
 */
async function ensureUserDocument(
  userId: string,
  decodedToken: { email?: string; name?: string; picture?: string }
): Promise<void> {
  const userRef = adminDb.collection('users').doc(userId);
  const userSnap = await userRef.get();

  if (userSnap.exists) {
    // User exists — update last login
    await userRef.update({
      lastLoginAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  // Create new user document (Flow B: user created via invitation acceptance)
  await userRef.set({
    uid: userId,
    email: decodedToken.email || '',
    displayName: decodedToken.name || '',
    photoURL: decodedToken.picture || null,
    authProvider: 'google.com', // Currently only Google OAuth
    createdAt: FieldValue.serverTimestamp(),
    lastLoginAt: FieldValue.serverTimestamp(),
  });
}
