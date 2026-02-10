/**
 * Organization Firestore Operations
 * Organization Domain - Phase 1
 * 
 * CRUD operations for organizations and organizationMembers collections
 * Handles both onboarding flows:
 * - Flow A: New user creates new organization
 * - Flow B: New user joins existing organization
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
  type Query,
} from 'firebase/firestore';
import { db } from '../config';
import { createConverter, convertFromFirestore } from './converters';
import {
  validateOrganizationData,
  validateUpdateOrganizationData,
  validateOrganizationMemberData,
  validateUpdateOrganizationMemberData,
  type Organization,
  type OrganizationDocument,
  type CreateOrganizationData,
  type UpdateOrganizationData,
  type OrganizationMember,
  type OrganizationMemberDocument,
  type CreateOrganizationMemberSelfData,
  type InviteOrganizationMemberData,
  type UpdateOrganizationMemberData,
  toBranded,
  fromBranded,
  type OrganizationId,
  type OrganizationMemberId,
  type UserId,
  type BrandId,
} from '@brayford/core';

// ===== Converters =====

const organizationConverter = createConverter(validateOrganizationData, ['createdAt', 'softDeletedAt']);
const organizationMemberConverter = createConverter(validateOrganizationMemberData, [
  'invitedAt',
  'joinedAt',
]);

// ===== Organization Operations =====

/**
 * Get reference to an organization document
 */
export function getOrganizationRef(
  organizationId: OrganizationId
): DocumentReference<Organization> {
  return doc(db, 'organizations', fromBranded(organizationId)).withConverter(
    organizationConverter
  );
}

/**
 * Get organization by ID
 */
export async function getOrganization(
  organizationId: OrganizationId
): Promise<OrganizationDocument | null> {
  const orgRef = getOrganizationRef(organizationId);
  const orgSnap = await getDoc(orgRef);
  
  if (!orgSnap.exists()) {
    return null;
  }
  
  return {
    id: organizationId,
    ...orgSnap.data(),
  };
}

/**
 * Create new organization (Flow A: self-creation)
 * 
 * This is used when a new user signs up and creates their own organization.
 * An organizationMember document is also created with owner role.
 * 
 * @param data - Organization creation data
 * @param userId - ID of user creating the organization
 * @returns ID of newly created organization
 * 
 * @example
 * ```ts
 * // User signs up and creates their organization
 * const orgId = await createOrganization({
 *   name: 'Acme Corp',
 *   type: 'individual',
 *   billingEmail: 'user@example.com',
 *   createdBy: userId,
 * }, userId);
 * ```
 */
export async function createOrganization(
  data: CreateOrganizationData,
  userId: UserId
): Promise<OrganizationId> {
  // Generate new organization ID
  const orgRef = doc(collection(db, 'organizations'));
  const organizationId = toBranded<OrganizationId>(orgRef.id);
  
  // Create organization document
  await setDoc(orgRef, {
    ...data,
    createdAt: serverTimestamp(),
  });
  
  // Create organization member document (owner role, no invitation)
  await createOrganizationMember(
    {
      organizationId: fromBranded(organizationId),
      userId: fromBranded(userId),
      role: 'owner',
      brandAccess: [], // Empty = access to all brands
    },
    null // No invitation for self-created org
  );
  
  return organizationId;
}

/**
 * Update organization
 */
export async function updateOrganization(
  organizationId: OrganizationId,
  data: UpdateOrganizationData
): Promise<void> {
  const validatedData = validateUpdateOrganizationData(data);
  const orgRef = doc(db, 'organizations', fromBranded(organizationId));
  await updateDoc(orgRef, validatedData);
}

/**
 * Delete organization
 * 
 * WARNING: This does not cascade delete related data (members, brands, events).
 * Consider soft-deletion or implement cascade logic in Cloud Functions.
 */
export async function deleteOrganization(organizationId: OrganizationId): Promise<void> {
  const orgRef = doc(db, 'organizations', fromBranded(organizationId));
  await deleteDoc(orgRef);
}

// ===== Organization Member Operations =====

/**
 * Get reference to an organization member document
 */
export function getOrganizationMemberRef(
  memberId: OrganizationMemberId
): DocumentReference<OrganizationMember> {
  return doc(db, 'organizationMembers', fromBranded(memberId)).withConverter(
    organizationMemberConverter
  );
}

/**
 * Get organization member by ID
 */
export async function getOrganizationMember(
  memberId: OrganizationMemberId
): Promise<OrganizationMemberDocument | null> {
  const memberRef = getOrganizationMemberRef(memberId);
  const memberSnap = await getDoc(memberRef);
  
  if (!memberSnap.exists()) {
    return null;
  }
  
  const data = memberSnap.data();
  return {
    id: memberId,
    ...data,
    organizationId: toBranded<OrganizationId>(data.organizationId),
    userId: toBranded<UserId>(data.userId),
    brandAccess: data.brandAccess.map((id) => toBranded<BrandId>(id)),
    invitedBy: data.invitedBy ? toBranded<UserId>(data.invitedBy) : null,
  };
}

/**
 * Create organization member
 * Internal helper used by createOrganization and inviteUserToOrganization
 * 
 * @param data - Member data
 * @param inviterUserId - ID of user who invited (null for self-created)
 */
async function createOrganizationMember(
  data: CreateOrganizationMemberSelfData,
  inviterUserId: UserId | null
): Promise<OrganizationMemberId> {
  const memberRef = doc(collection(db, 'organizationMembers'));
  const memberId = toBranded<OrganizationMemberId>(memberRef.id);
  
  await setDoc(memberRef, {
    ...data,
    invitedAt: inviterUserId ? serverTimestamp() : null,
    invitedBy: inviterUserId ? fromBranded(inviterUserId) : null,
    joinedAt: serverTimestamp(),
  });
  
  return memberId;
}

/**
 * Invite user to organization (Flow B: invitation)
 * 
 * Creates a pending organizationMember document.
 * User must accept invitation to activate membership.
 * 
 * @param data - Invitation data
 * @param inviterUserId - ID of user sending invitation
 * @returns ID of created member document
 * 
 * @example
 * ```ts
 * await inviteUserToOrganization({
 *   organizationId: orgId,
 *   userId: newUserId,
 *   role: 'member',
 *   brandAccess: [brandId1, brandId2],
 * }, currentUserId);
 * ```
 */
export async function inviteUserToOrganization(
  data: InviteOrganizationMemberData,
  inviterUserId: UserId
): Promise<OrganizationMemberId> {
  const memberRef = doc(collection(db, 'organizationMembers'));
  const memberId = toBranded<OrganizationMemberId>(memberRef.id);
  
  await setDoc(memberRef, {
    ...data,
    invitedAt: serverTimestamp(),
    invitedBy: fromBranded(inviterUserId),
    joinedAt: serverTimestamp(), // For now, immediate join (can add pending state later)
  });
  
  return memberId;
}

/**
 * Update organization member
 * Typically used to change role or brand access
 */
export async function updateOrganizationMember(
  memberId: OrganizationMemberId,
  data: UpdateOrganizationMemberData
): Promise<void> {
  const validatedData = validateUpdateOrganizationMemberData(data);
  const memberRef = doc(db, 'organizationMembers', fromBranded(memberId));
  await updateDoc(memberRef, validatedData);
}

/**
 * Remove user from organization
 * Deletes the organizationMember document
 */
export async function removeOrganizationMember(
  memberId: OrganizationMemberId
): Promise<void> {
  const memberRef = doc(db, 'organizationMembers', fromBranded(memberId));
  await deleteDoc(memberRef);
}

/**
 * Get all members of an organization
 * 
 * @param organizationId - Organization ID
 * @returns Array of organization member documents
 * 
 * @example
 * ```ts
 * const members = await getOrganizationMembers(orgId);
 * console.log(`${members.length} team members`);
 * ```
 */
export async function getOrganizationMembers(
  organizationId: OrganizationId
): Promise<OrganizationMemberDocument[]> {
  const membersQuery = query(
    collection(db, 'organizationMembers'),
    where('organizationId', '==', fromBranded(organizationId))
  );
  
  const querySnap = await getDocs(membersQuery);
  
  return querySnap.docs.map((doc) => {
    const data = convertFromFirestore(
      doc.data(),
      validateOrganizationMemberData,
      ['invitedAt', 'joinedAt']
    );
    
    return {
      id: toBranded<OrganizationMemberId>(doc.id),
      ...data,
      organizationId: toBranded<OrganizationId>(data.organizationId),
      userId: toBranded<UserId>(data.userId),
      brandAccess: data.brandAccess.map((id) => toBranded<BrandId>(id)),
      invitedBy: data.invitedBy ? toBranded<UserId>(data.invitedBy) : null,
    };
  });
}

/**
 * Get count of owners in an organization
 * 
 * Used for validation when demoting owners (prevent last owner from removing themselves)
 * 
 * @param organizationId - Organization ID
 * @returns Number of owners in the organization
 * 
 * @example
 * ```ts
 * const ownerCount = await getOwnerCount(orgId);
 * if (ownerCount === 1) {
 *   throw new Error('Cannot remove last owner');
 * }
 * ```
 */
export async function getOwnerCount(
  organizationId: OrganizationId
): Promise<number> {
  const ownersQuery = query(
    collection(db, 'organizationMembers'),
    where('organizationId', '==', fromBranded(organizationId)),
    where('role', '==', 'owner')
  );
  
  const querySnap = await getDocs(ownersQuery);
  return querySnap.size;
}

/**
 * Get all organizations a user is a member of
 * 
 * @param userId - User ID
 * @returns Array of organization member documents
 * 
 * @example
 * ```ts
 * const memberships = await getUserOrganizations(userId);
 * for (const membership of memberships) {
 *   const org = await getOrganization(membership.organizationId);
 *   console.log(`Member of: ${org.name}`);
 * }
 * ```
 */
export async function getUserOrganizations(
  userId: UserId
): Promise<OrganizationMemberDocument[]> {
  const membersQuery = query(
    collection(db, 'organizationMembers'),
    where('userId', '==', fromBranded(userId))
  );
  
  const querySnap = await getDocs(membersQuery);
  
  return querySnap.docs.map((doc) => {
    const data = convertFromFirestore(
      doc.data(),
      validateOrganizationMemberData,
      ['invitedAt', 'joinedAt']
    );
    
    return {
      id: toBranded<OrganizationMemberId>(doc.id),
      ...data,
      organizationId: toBranded<OrganizationId>(data.organizationId),
      userId: toBranded<UserId>(data.userId),
      brandAccess: data.brandAccess.map((id) => toBranded<BrandId>(id)),
      invitedBy: data.invitedBy ? toBranded<UserId>(data.invitedBy) : null,
    };
  });
}

/**
 * Organization member with enriched user details
 */
export interface OrganizationMemberWithUser extends OrganizationMemberDocument {
  user: import('@brayford/core').UserDocument | null;
}

/**
 * Get organization members with enriched user details
 * 
 * Fetches all organization members and joins with user data.
 * Efficiently batches user lookups to minimize database reads.
 * 
 * @param organizationId - Organization ID
 * @returns Array of members with user details attached
 * 
 * @example
 * ```ts
 * const membersWithUsers = await getOrganizationMembersWithUsers(orgId);
 * membersWithUsers.forEach(member => {
 *   console.log(`${member.user?.displayName} - ${member.role}`);
 * });
 * ```
 */
export async function getOrganizationMembersWithUsers(
  organizationId: OrganizationId
): Promise<OrganizationMemberWithUser[]> {
  // Import here to avoid circular dependency
  const { batchGetUsers } = await import('./users');
  
  // 1. Fetch all organization members
  const members = await getOrganizationMembers(organizationId);
  
  if (members.length === 0) {
    return [];
  }
  
  // 2. Extract unique user IDs
  const userIds = members.map((member) => member.userId);
  
  // 3. Batch fetch user details
  const users = await batchGetUsers(userIds);
  
  // 4. Join member data with user data
  return members.map((member, index) => ({
    ...member,
    user: users[index],
  }));
}
