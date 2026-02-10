/**
 * Firestore seeding helpers for E2E tests.
 *
 * Uses firebase-admin SDK to write seed data directly to the
 * Firestore emulator. The admin SDK auto-connects when
 * FIRESTORE_EMULATOR_HOST is set (configured in playwright.config.ts).
 */

import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getPermissionsForRole } from '@brayford/core';

const db = getFirestore();

/**
 * Seed an organization document in Firestore.
 */
export async function seedOrganization(
  orgId: string,
  data: {
    name: string;
    type: 'individual' | 'team';
    billingEmail: string;
    createdBy: string;
  },
): Promise<void> {
  await db
    .collection('organizations')
    .doc(orgId)
    .set({
      ...data,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
}

/**
 * Seed an organization member document in Firestore.
 */
export async function seedOrganizationMember(
  memberId: string,
  data: {
    organizationId: string;
    userId: string;
    role: 'owner' | 'admin' | 'member';
    brandAccess: string[];
    autoGrantNewBrands: boolean;
  },
): Promise<void> {
  await db
    .collection('organizationMembers')
    .doc(memberId)
    .set({
      ...data,
      permissions: getPermissionsForRole(data.role),
      joinedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
}

/**
 * Seed a user document in Firestore.
 */
export async function seedUser(
  userId: string,
  data: {
    email: string;
    displayName: string;
    photoURL?: string;
  },
): Promise<void> {
  await db
    .collection('users')
    .doc(userId)
    .set({
      ...data,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastLoginAt: FieldValue.serverTimestamp(),
    });
}

/**
 * Seed a brand document in Firestore.
 */
export async function seedBrand(
  brandId: string,
  data: {
    organizationId: string;
    name: string;
    description?: string;
  },
): Promise<void> {
  await db
    .collection('brands')
    .doc(brandId)
    .set({
      ...data,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
}

/**
 * Convenience: seed a complete org with owner user and membership.
 * Returns the generated IDs.
 */
export async function seedCompleteOrganization(opts: {
  orgId: string;
  orgName: string;
  orgType: 'individual' | 'team';
  billingEmail: string;
  ownerUid: string;
  ownerEmail: string;
  ownerDisplayName: string;
}): Promise<void> {
  const memberId = `${opts.orgId}_${opts.ownerUid}`;

  await Promise.all([
    seedOrganization(opts.orgId, {
      name: opts.orgName,
      type: opts.orgType,
      billingEmail: opts.billingEmail,
      createdBy: opts.ownerUid,
    }),
    seedUser(opts.ownerUid, {
      email: opts.ownerEmail,
      displayName: opts.ownerDisplayName,
    }),
    seedOrganizationMember(memberId, {
      organizationId: opts.orgId,
      userId: opts.ownerUid,
      role: 'owner',
      brandAccess: [],
      autoGrantNewBrands: true,
    }),
  ]);
}
