/**
 * Invitation Firestore Operations
 * Organization Domain - Invitation System
 * 
 * CRUD operations for the /invitations collection.
 * Handles invitation creation, lookup by token/email/org, and status updates.
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
  validateInvitationData,
  validateUpdateInvitationData,
  generateInvitationToken,
  calculateInvitationExpiry,
  type Invitation,
  type InvitationDocument,
  type CreateInvitationData,
  type UpdateInvitationData,
  type InvitationStatus,
  toBranded,
  fromBranded,
  type InvitationId,
  type OrganizationId,
  type UserId,
  type BrandId,
} from '@brayford/core';

// ===== Converter =====

const invitationConverter = createConverter(validateInvitationData, [
  'invitedAt',
  'expiresAt',
  'acceptedAt',
]);

// ===== Helpers =====

/**
 * Map raw Firestore invitation data to a typed InvitationDocument
 */
function toInvitationDocument(
  id: string,
  data: Invitation
): InvitationDocument {
  return {
    id: toBranded<InvitationId>(id),
    ...data,
    organizationId: toBranded<OrganizationId>(data.organizationId),
    invitedBy: toBranded<UserId>(data.invitedBy),
    brandAccess: data.brandAccess.map((b) => toBranded<BrandId>(b)),
  };
}

// ===== Read Operations =====

/**
 * Get reference to an invitation document
 */
export function getInvitationRef(
  invitationId: InvitationId
): DocumentReference<Invitation> {
  return doc(db, 'invitations', fromBranded(invitationId)).withConverter(
    invitationConverter
  );
}

/**
 * Get invitation by ID
 */
export async function getInvitation(
  invitationId: InvitationId
): Promise<InvitationDocument | null> {
  const invRef = getInvitationRef(invitationId);
  const invSnap = await getDoc(invRef);

  if (!invSnap.exists()) {
    return null;
  }

  return toInvitationDocument(invSnap.id, invSnap.data());
}

/**
 * Get invitation by its secure token
 * Used when a user clicks the invitation link
 * 
 * @param token - The secure UUID from the invitation email link
 * @returns Invitation document or null if not found
 */
export async function getInvitationByToken(
  token: string
): Promise<InvitationDocument | null> {
  const invQuery = query(
    collection(db, 'invitations'),
    where('token', '==', token)
  );

  const querySnap = await getDocs(invQuery);

  if (querySnap.empty) {
    return null;
  }

  // Token should be unique — take the first result
  const docSnap = querySnap.docs[0]!;
  const data = convertFromFirestore(
    docSnap.data(),
    validateInvitationData,
    ['invitedAt', 'expiresAt', 'acceptedAt']
  );

  return toInvitationDocument(docSnap.id, data);
}

/**
 * Get all pending invitations for a given email address
 * Used to show "you have N pending invitations" on the join page
 * 
 * @param email - Normalized email address
 * @returns Array of pending invitation documents
 */
export async function getPendingInvitationsByEmail(
  email: string
): Promise<InvitationDocument[]> {
  const normalizedEmail = email.toLowerCase().trim();

  const invQuery = query(
    collection(db, 'invitations'),
    where('email', '==', normalizedEmail),
    where('status', '==', 'pending')
  );

  const querySnap = await getDocs(invQuery);

  return querySnap.docs.map((docSnap) => {
    const data = convertFromFirestore(
      docSnap.data(),
      validateInvitationData,
      ['invitedAt', 'expiresAt', 'acceptedAt']
    );
    return toInvitationDocument(docSnap.id, data);
  });
}

/**
 * Get all invitations for an organization (any status)
 * Used by admins to see pending/accepted/declined invitations
 * 
 * @param organizationId - Organization ID
 * @returns Array of invitation documents
 */
export async function getOrganizationInvitations(
  organizationId: OrganizationId
): Promise<InvitationDocument[]> {
  const invQuery = query(
    collection(db, 'invitations'),
    where('organizationId', '==', fromBranded(organizationId))
  );

  const querySnap = await getDocs(invQuery);

  return querySnap.docs.map((docSnap) => {
    const data = convertFromFirestore(
      docSnap.data(),
      validateInvitationData,
      ['invitedAt', 'expiresAt', 'acceptedAt']
    );
    return toInvitationDocument(docSnap.id, data);
  });
}

/**
 * Get pending invitations for an organization only
 * Used to display pending invitations in the team members list
 */
export async function getOrganizationPendingInvitations(
  organizationId: OrganizationId
): Promise<InvitationDocument[]> {
  const invQuery = query(
    collection(db, 'invitations'),
    where('organizationId', '==', fromBranded(organizationId)),
    where('status', '==', 'pending')
  );

  const querySnap = await getDocs(invQuery);

  return querySnap.docs.map((docSnap) => {
    const data = convertFromFirestore(
      docSnap.data(),
      validateInvitationData,
      ['invitedAt', 'expiresAt', 'acceptedAt']
    );
    return toInvitationDocument(docSnap.id, data);
  });
}

/**
 * Check if a pending invitation already exists for an email + organization combo
 * Used to prevent duplicate invitations
 */
export async function pendingInvitationExists(
  email: string,
  organizationId: OrganizationId
): Promise<InvitationDocument | null> {
  const normalizedEmail = email.toLowerCase().trim();

  const invQuery = query(
    collection(db, 'invitations'),
    where('email', '==', normalizedEmail),
    where('organizationId', '==', fromBranded(organizationId)),
    where('status', '==', 'pending')
  );

  const querySnap = await getDocs(invQuery);

  if (querySnap.empty) {
    return null;
  }

  const docSnap = querySnap.docs[0]!;
  const data = convertFromFirestore(
    docSnap.data(),
    validateInvitationData,
    ['invitedAt', 'expiresAt', 'acceptedAt']
  );

  return toInvitationDocument(docSnap.id, data);
}

// ===== Write Operations =====

/**
 * Create a new invitation
 * 
 * Generates a secure token and sets expiry date automatically.
 * Status is set to 'pending'.
 * 
 * @param data - Invitation creation data
 * @returns The created invitation document (with generated ID, token, etc.)
 * 
 * @example
 * ```ts
 * const invitation = await createInvitation({
 *   email: 'newuser@example.com',
 *   organizationId: fromBranded(orgId),
 *   organizationName: org.name,
 *   role: 'member',
 *   brandAccess: [fromBranded(brandId)],
 *   autoGrantNewBrands: false,
 *   invitedBy: fromBranded(currentUserId),
 *   token: generateInvitationToken(),
 *   expiresAt: calculateInvitationExpiry(),
 *   metadata: { inviterName: 'Alice', inviterEmail: 'alice@org.com' },
 * });
 * ```
 */
export async function createInvitation(
  data: CreateInvitationData
): Promise<InvitationDocument> {
  const invRef = doc(collection(db, 'invitations'));
  const invitationId = toBranded<InvitationId>(invRef.id);

  const invitationData = {
    ...data,
    email: data.email.toLowerCase().trim(),
    status: 'pending' as const,
    invitedAt: serverTimestamp(),
    acceptedAt: null,
  };

  await setDoc(invRef, invitationData);

  // Return the document shape (invitedAt will be a server timestamp,
  // but we approximate with the current time for immediate use)
  return toInvitationDocument(invRef.id, {
    ...invitationData,
    invitedAt: new Date(),
  });
}

/**
 * Update an invitation (status change, resend, etc.)
 */
export async function updateInvitation(
  invitationId: InvitationId,
  data: UpdateInvitationData
): Promise<void> {
  const validatedData = validateUpdateInvitationData(data);
  const invRef = doc(db, 'invitations', fromBranded(invitationId));
  await updateDoc(invRef, validatedData);
}

/**
 * Mark invitation as accepted
 * Sets status to 'accepted' and records the acceptance timestamp
 */
export async function acceptInvitation(
  invitationId: InvitationId
): Promise<void> {
  const invRef = doc(db, 'invitations', fromBranded(invitationId));
  await updateDoc(invRef, {
    status: 'accepted',
    acceptedAt: serverTimestamp(),
  });
}

/**
 * Mark invitation as declined
 */
export async function declineInvitation(
  invitationId: InvitationId
): Promise<void> {
  const invRef = doc(db, 'invitations', fromBranded(invitationId));
  await updateDoc(invRef, {
    status: 'declined',
  });
}

/**
 * Resend an invitation (resets expiry, keeps same token)
 */
export async function resendInvitation(
  invitationId: InvitationId
): Promise<void> {
  const invRef = doc(db, 'invitations', fromBranded(invitationId));
  await updateDoc(invRef, {
    expiresAt: calculateInvitationExpiry(),
  });
}

/**
 * Cancel (delete) a pending invitation
 * Only used by admins to revoke an invitation before it's accepted
 */
export async function cancelInvitation(
  invitationId: InvitationId
): Promise<void> {
  const invRef = doc(db, 'invitations', fromBranded(invitationId));
  await deleteDoc(invRef);
}
