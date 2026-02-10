/**
 * Firestore Security Rules Test Suite
 *
 * Tests all Firestore rules using @firebase/rules-unit-testing.
 * Runs against an in-process rules evaluation engine — no emulator needed.
 *
 * Covers:
 * - Users collection: read, create, update, delete rules
 * - Organizations collection: claims-based read, write denial
 * - Organization Members collection: claims-based read, write denial
 * - Brands collection: claims-based read, write denial
 * - Invitations collection: email-based + permission-based read, write denial
 * - Server-only collections: deny all
 * - Cross-organisation isolation
 * - Default deny-all catch
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
  type RulesTestContext,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  setLogLevel,
} from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';

// Suppress Firestore debug logging during tests
setLogLevel('error');

// ===== Test Environment Setup =====

const PROJECT_ID = 'rules-test-project';
const RULES_PATH = resolve(__dirname, '../../firestore.rules');

let testEnv: RulesTestEnvironment;

// Claims helper — builds a token with org membership claims
function orgMemberToken(
  uid: string,
  email: string,
  orgId: string,
  permissions: string[] = ['*'],
  brands: string[] = [],
) {
  return {
    uid,
    email,
    token: {
      email,
      orgs: {
        [orgId]: { p: permissions, b: brands },
      },
    },
  };
}

// Multi-org claims
function multiOrgMemberToken(
  uid: string,
  email: string,
  orgs: Record<string, { p: string[]; b: string[] }>,
) {
  return {
    uid,
    email,
    token: {
      email,
      orgs,
    },
  };
}

// Authenticated user with no org claims
function plainAuthToken(uid: string, email: string) {
  return {
    uid,
    email,
    token: { email },
  };
}

beforeAll(async () => {
  const rules = readFileSync(RULES_PATH, 'utf-8');
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

// ===== Helper to seed docs via admin context =====

async function seedDoc(path: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, path), data);
  });
}

// ===== Users Collection =====

describe('Users collection', () => {
  const userId = 'user-1';
  const userEmail = 'alice@example.com';
  const userDoc = {
    uid: userId,
    email: userEmail,
    displayName: 'Alice',
    photoURL: 'https://example.com/photo.jpg',
    authProvider: 'google.com',
    createdAt: new Date('2024-01-01'),
    lastLoginAt: new Date('2024-01-15'),
    claimsVersion: 0,
  };

  describe('read', () => {
    it('allows any authenticated user to read any user doc', async () => {
      await seedDoc(`users/${userId}`, userDoc);
      const ctx = testEnv.authenticatedContext('other-user', { email: 'other@example.com' });
      await assertSucceeds(getDoc(doc(ctx.firestore(), 'users', userId)));
    });

    it('denies unauthenticated reads', async () => {
      await seedDoc(`users/${userId}`, userDoc);
      const ctx = testEnv.unauthenticatedContext();
      await assertFails(getDoc(doc(ctx.firestore(), 'users', userId)));
    });
  });

  describe('create', () => {
    it('allows a user to create their own profile', async () => {
      const ctx = testEnv.authenticatedContext(userId, { email: userEmail });
      await assertSucceeds(setDoc(doc(ctx.firestore(), 'users', userId), userDoc));
    });

    it('denies creating a profile for another user', async () => {
      const ctx = testEnv.authenticatedContext('other-user', { email: 'other@example.com' });
      await assertFails(setDoc(doc(ctx.firestore(), 'users', userId), userDoc));
    });

    it('denies unauthenticated profile creation', async () => {
      const ctx = testEnv.unauthenticatedContext();
      await assertFails(setDoc(doc(ctx.firestore(), 'users', userId), userDoc));
    });
  });

  describe('update', () => {
    beforeEach(async () => {
      await seedDoc(`users/${userId}`, userDoc);
    });

    it('allows updating own displayName and photoURL', async () => {
      const ctx = testEnv.authenticatedContext(userId, { email: userEmail });
      await assertSucceeds(
        updateDoc(doc(ctx.firestore(), 'users', userId), {
          displayName: 'Alice Updated',
          photoURL: 'https://example.com/new-photo.jpg',
          // Must preserve immutable fields
          uid: userId,
          email: userEmail,
          authProvider: 'google.com',
          createdAt: userDoc.createdAt,
          claimsVersion: 0,
        }),
      );
    });

    it('denies updating another user\'s profile', async () => {
      const ctx = testEnv.authenticatedContext('other-user', { email: 'other@example.com' });
      await assertFails(
        updateDoc(doc(ctx.firestore(), 'users', userId), {
          displayName: 'Hacked',
          uid: userId,
          email: userEmail,
          authProvider: 'google.com',
          createdAt: userDoc.createdAt,
          claimsVersion: 0,
        }),
      );
    });

    it('denies changing own email', async () => {
      const ctx = testEnv.authenticatedContext(userId, { email: userEmail });
      await assertFails(
        updateDoc(doc(ctx.firestore(), 'users', userId), {
          displayName: 'Alice',
          photoURL: userDoc.photoURL,
          uid: userId,
          email: 'newemail@example.com', // Trying to change email
          authProvider: 'google.com',
          createdAt: userDoc.createdAt,
          claimsVersion: 0,
        }),
      );
    });

    it('denies changing own uid', async () => {
      const ctx = testEnv.authenticatedContext(userId, { email: userEmail });
      await assertFails(
        updateDoc(doc(ctx.firestore(), 'users', userId), {
          displayName: 'Alice',
          uid: 'different-uid', // Trying to change uid
          email: userEmail,
          authProvider: 'google.com',
          createdAt: userDoc.createdAt,
          claimsVersion: 0,
        }),
      );
    });

    it('denies changing claimsVersion (server-only field)', async () => {
      const ctx = testEnv.authenticatedContext(userId, { email: userEmail });
      await assertFails(
        updateDoc(doc(ctx.firestore(), 'users', userId), {
          displayName: 'Alice',
          uid: userId,
          email: userEmail,
          authProvider: 'google.com',
          createdAt: userDoc.createdAt,
          claimsVersion: 1, // Trying to bump claimsVersion
        }),
      );
    });
  });

  describe('delete', () => {
    it('denies deleting any user doc', async () => {
      await seedDoc(`users/${userId}`, userDoc);
      const ctx = testEnv.authenticatedContext(userId, { email: userEmail });
      await assertFails(deleteDoc(doc(ctx.firestore(), 'users', userId)));
    });
  });
});

// ===== Organizations Collection =====

describe('Organizations collection', () => {
  const orgId = 'org-1';
  const orgDoc = {
    name: 'Test Org',
    type: 'individual',
    billingEmail: 'billing@test.com',
    createdBy: 'user-1',
    createdAt: new Date(),
  };

  describe('read', () => {
    beforeEach(async () => {
      await seedDoc(`organizations/${orgId}`, orgDoc);
    });

    it('allows org members to read their org', async () => {
      const auth = orgMemberToken('user-1', 'user@test.com', orgId);
      const ctx = testEnv.authenticatedContext(auth.uid, auth.token);
      await assertSucceeds(getDoc(doc(ctx.firestore(), 'organizations', orgId)));
    });

    it('denies non-members from reading the org', async () => {
      const auth = orgMemberToken('user-2', 'user2@test.com', 'other-org');
      const ctx = testEnv.authenticatedContext(auth.uid, auth.token);
      await assertFails(getDoc(doc(ctx.firestore(), 'organizations', orgId)));
    });

    it('denies authenticated users without org claims', async () => {
      const ctx = testEnv.authenticatedContext('user-3', { email: 'user3@test.com' });
      await assertFails(getDoc(doc(ctx.firestore(), 'organizations', orgId)));
    });

    it('denies unauthenticated access', async () => {
      const ctx = testEnv.unauthenticatedContext();
      await assertFails(getDoc(doc(ctx.firestore(), 'organizations', orgId)));
    });
  });

  describe('write', () => {
    it('denies all client writes — even for org members', async () => {
      const auth = orgMemberToken('user-1', 'user@test.com', orgId);
      const ctx = testEnv.authenticatedContext(auth.uid, auth.token);
      await assertFails(setDoc(doc(ctx.firestore(), 'organizations', orgId), orgDoc));
    });

    it('denies updates from org members', async () => {
      await seedDoc(`organizations/${orgId}`, orgDoc);
      const auth = orgMemberToken('user-1', 'user@test.com', orgId);
      const ctx = testEnv.authenticatedContext(auth.uid, auth.token);
      await assertFails(updateDoc(doc(ctx.firestore(), 'organizations', orgId), { name: 'Hacked' }));
    });

    it('denies deletes from org members', async () => {
      await seedDoc(`organizations/${orgId}`, orgDoc);
      const auth = orgMemberToken('user-1', 'user@test.com', orgId);
      const ctx = testEnv.authenticatedContext(auth.uid, auth.token);
      await assertFails(deleteDoc(doc(ctx.firestore(), 'organizations', orgId)));
    });
  });
});

// ===== Organization Members Collection =====

describe('Organization Members collection', () => {
  const orgId = 'org-1';
  const memberId = 'member-1';
  const memberDoc = {
    userId: 'user-1',
    organizationId: orgId,
    role: 'owner',
    brandAccess: [],
    autoGrantNewBrands: true,
    joinedAt: new Date(),
  };

  describe('read', () => {
    beforeEach(async () => {
      await seedDoc(`organizationMembers/${memberId}`, memberDoc);
    });

    it('allows org members to read fellow membership records', async () => {
      const auth = orgMemberToken('user-1', 'user@test.com', orgId);
      const ctx = testEnv.authenticatedContext(auth.uid, auth.token);
      await assertSucceeds(getDoc(doc(ctx.firestore(), 'organizationMembers', memberId)));
    });

    it('denies non-members from reading membership records', async () => {
      const auth = orgMemberToken('user-2', 'user2@test.com', 'other-org');
      const ctx = testEnv.authenticatedContext(auth.uid, auth.token);
      await assertFails(getDoc(doc(ctx.firestore(), 'organizationMembers', memberId)));
    });

    it('denies unauthenticated access', async () => {
      const ctx = testEnv.unauthenticatedContext();
      await assertFails(getDoc(doc(ctx.firestore(), 'organizationMembers', memberId)));
    });
  });

  describe('write', () => {
    it('denies all client writes', async () => {
      const auth = orgMemberToken('user-1', 'user@test.com', orgId);
      const ctx = testEnv.authenticatedContext(auth.uid, auth.token);
      await assertFails(setDoc(doc(ctx.firestore(), 'organizationMembers', 'new-member'), memberDoc));
    });

    it('denies updates from org members', async () => {
      await seedDoc(`organizationMembers/${memberId}`, memberDoc);
      const auth = orgMemberToken('user-1', 'user@test.com', orgId);
      const ctx = testEnv.authenticatedContext(auth.uid, auth.token);
      await assertFails(updateDoc(doc(ctx.firestore(), 'organizationMembers', memberId), { role: 'admin' }));
    });

    it('denies deletes from org members', async () => {
      await seedDoc(`organizationMembers/${memberId}`, memberDoc);
      const auth = orgMemberToken('user-1', 'user@test.com', orgId);
      const ctx = testEnv.authenticatedContext(auth.uid, auth.token);
      await assertFails(deleteDoc(doc(ctx.firestore(), 'organizationMembers', memberId)));
    });
  });
});

// ===== Brands Collection =====

describe('Brands collection', () => {
  const orgId = 'org-1';
  const brandId = 'brand-1';
  const brandDoc = {
    name: 'Test Brand',
    organizationId: orgId,
    createdBy: 'user-1',
    createdAt: new Date(),
  };

  describe('read', () => {
    beforeEach(async () => {
      await seedDoc(`brands/${brandId}`, brandDoc);
    });

    it('allows org members to read brands in their org', async () => {
      const auth = orgMemberToken('user-1', 'user@test.com', orgId);
      const ctx = testEnv.authenticatedContext(auth.uid, auth.token);
      await assertSucceeds(getDoc(doc(ctx.firestore(), 'brands', brandId)));
    });

    it('denies non-members from reading brands', async () => {
      const auth = orgMemberToken('user-2', 'user2@test.com', 'other-org');
      const ctx = testEnv.authenticatedContext(auth.uid, auth.token);
      await assertFails(getDoc(doc(ctx.firestore(), 'brands', brandId)));
    });

    it('denies unauthenticated access', async () => {
      const ctx = testEnv.unauthenticatedContext();
      await assertFails(getDoc(doc(ctx.firestore(), 'brands', brandId)));
    });
  });

  describe('write', () => {
    it('denies all client writes', async () => {
      const auth = orgMemberToken('user-1', 'user@test.com', orgId);
      const ctx = testEnv.authenticatedContext(auth.uid, auth.token);
      await assertFails(setDoc(doc(ctx.firestore(), 'brands', brandId), brandDoc));
    });
  });
});

// ===== Invitations Collection =====

describe('Invitations collection', () => {
  const orgId = 'org-1';
  const invitationId = 'inv-1';
  const inviteeEmail = 'alice@example.com';
  const invitationDoc = {
    email: inviteeEmail,
    organizationId: orgId,
    organizationName: 'Test Org',
    role: 'member',
    status: 'pending',
    token: 'abc123',
    invitedBy: 'user-1',
    invitedAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    brandAccess: [],
    autoGrantNewBrands: false,
  };

  describe('read', () => {
    beforeEach(async () => {
      await seedDoc(`invitations/${invitationId}`, invitationDoc);
    });

    it('allows the invitee to read their invitation (email match)', async () => {
      const ctx = testEnv.authenticatedContext('invitee-user', {
        email: inviteeEmail,
      });
      await assertSucceeds(getDoc(doc(ctx.firestore(), 'invitations', invitationId)));
    });

    it('allows case-insensitive email matching', async () => {
      const ctx = testEnv.authenticatedContext('invitee-user', {
        email: 'ALICE@EXAMPLE.COM',
      });
      await assertSucceeds(getDoc(doc(ctx.firestore(), 'invitations', invitationId)));
    });

    it('allows org members with invite permission to read invitations', async () => {
      // 'ui' = abbreviated 'users:invite' permission
      const auth = orgMemberToken('admin-user', 'admin@test.com', orgId, ['ui']);
      const ctx = testEnv.authenticatedContext(auth.uid, auth.token);
      await assertSucceeds(getDoc(doc(ctx.firestore(), 'invitations', invitationId)));
    });

    it('allows org owners (wildcard) to read invitations', async () => {
      const auth = orgMemberToken('owner-user', 'owner@test.com', orgId, ['*']);
      const ctx = testEnv.authenticatedContext(auth.uid, auth.token);
      await assertSucceeds(getDoc(doc(ctx.firestore(), 'invitations', invitationId)));
    });

    it('denies org members without invite permission', async () => {
      // 'bv' = brands:view — does not include invite permission
      const auth = orgMemberToken('member-user', 'member@test.com', orgId, ['bv', 'ev']);
      const ctx = testEnv.authenticatedContext(auth.uid, auth.token);
      await assertFails(getDoc(doc(ctx.firestore(), 'invitations', invitationId)));
    });

    it('denies users with no email match and no org membership', async () => {
      const ctx = testEnv.authenticatedContext('random-user', {
        email: 'random@other.com',
      });
      await assertFails(getDoc(doc(ctx.firestore(), 'invitations', invitationId)));
    });

    it('denies unauthenticated access', async () => {
      const ctx = testEnv.unauthenticatedContext();
      await assertFails(getDoc(doc(ctx.firestore(), 'invitations', invitationId)));
    });
  });

  describe('write', () => {
    it('denies all client writes — even for invitee', async () => {
      const ctx = testEnv.authenticatedContext('invitee-user', {
        email: inviteeEmail,
      });
      await assertFails(setDoc(doc(ctx.firestore(), 'invitations', invitationId), invitationDoc));
    });

    it('denies updates from org owners', async () => {
      await seedDoc(`invitations/${invitationId}`, invitationDoc);
      const auth = orgMemberToken('owner-user', 'owner@test.com', orgId, ['*']);
      const ctx = testEnv.authenticatedContext(auth.uid, auth.token);
      await assertFails(
        updateDoc(doc(ctx.firestore(), 'invitations', invitationId), { status: 'accepted' }),
      );
    });
  });
});

// ===== Cross-Organisation Isolation =====

describe('Cross-organisation isolation', () => {
  const org1Id = 'org-1';
  const org2Id = 'org-2';

  beforeEach(async () => {
    await seedDoc(`organizations/${org1Id}`, { name: 'Org 1', type: 'individual' });
    await seedDoc(`organizations/${org2Id}`, { name: 'Org 2', type: 'individual' });
    await seedDoc('organizationMembers/member-org1', {
      userId: 'user-1',
      organizationId: org1Id,
      role: 'owner',
    });
    await seedDoc('organizationMembers/member-org2', {
      userId: 'user-2',
      organizationId: org2Id,
      role: 'owner',
    });
    await seedDoc('brands/brand-org1', {
      name: 'Brand in Org 1',
      organizationId: org1Id,
    });
    await seedDoc('brands/brand-org2', {
      name: 'Brand in Org 2',
      organizationId: org2Id,
    });
  });

  it('org-1 member cannot read org-2 data', async () => {
    const auth = orgMemberToken('user-1', 'user1@test.com', org1Id);
    const db = testEnv.authenticatedContext(auth.uid, auth.token).firestore();

    await assertFails(getDoc(doc(db, 'organizations', org2Id)));
    await assertFails(getDoc(doc(db, 'organizationMembers', 'member-org2')));
    await assertFails(getDoc(doc(db, 'brands', 'brand-org2')));
  });

  it('org-2 member cannot read org-1 data', async () => {
    const auth = orgMemberToken('user-2', 'user2@test.com', org2Id);
    const db = testEnv.authenticatedContext(auth.uid, auth.token).firestore();

    await assertFails(getDoc(doc(db, 'organizations', org1Id)));
    await assertFails(getDoc(doc(db, 'organizationMembers', 'member-org1')));
    await assertFails(getDoc(doc(db, 'brands', 'brand-org1')));
  });

  it('multi-org user can read both orgs they belong to', async () => {
    const auth = multiOrgMemberToken('user-multi', 'multi@test.com', {
      [org1Id]: { p: ['*'], b: [] },
      [org2Id]: { p: ['bv'], b: [] },
    });
    const db = testEnv.authenticatedContext(auth.uid, auth.token).firestore();

    await assertSucceeds(getDoc(doc(db, 'organizations', org1Id)));
    await assertSucceeds(getDoc(doc(db, 'organizations', org2Id)));
    await assertSucceeds(getDoc(doc(db, 'brands', 'brand-org1')));
    await assertSucceeds(getDoc(doc(db, 'brands', 'brand-org2')));
  });
});

// ===== Server-Only Collections =====

describe('Server-only collections', () => {
  describe('organizationDeletionRequests', () => {
    it('denies all reads — even for authenticated users', async () => {
      await seedDoc('organizationDeletionRequests/req-1', { organizationId: 'org-1' });
      const ctx = testEnv.authenticatedContext('user-1', { email: 'user@test.com' });
      await assertFails(getDoc(doc(ctx.firestore(), 'organizationDeletionRequests', 'req-1')));
    });

    it('denies all writes', async () => {
      const ctx = testEnv.authenticatedContext('user-1', { email: 'user@test.com' });
      await assertFails(
        setDoc(doc(ctx.firestore(), 'organizationDeletionRequests', 'req-1'), { organizationId: 'org-1' }),
      );
    });
  });

  describe('deletedOrganizationsAudit', () => {
    it('denies all reads', async () => {
      await seedDoc('deletedOrganizationsAudit/audit-1', { organizationId: 'org-1' });
      const ctx = testEnv.authenticatedContext('user-1', { email: 'user@test.com' });
      await assertFails(getDoc(doc(ctx.firestore(), 'deletedOrganizationsAudit', 'audit-1')));
    });

    it('denies all writes', async () => {
      const ctx = testEnv.authenticatedContext('user-1', { email: 'user@test.com' });
      await assertFails(
        setDoc(doc(ctx.firestore(), 'deletedOrganizationsAudit', 'audit-1'), { organizationId: 'org-1' }),
      );
    });
  });
});

// ===== Default Deny =====

describe('Default deny rule', () => {
  it('denies access to unknown collections', async () => {
    const db = testEnv.authenticatedContext('user-1', { email: 'user@test.com' }).firestore();
    await assertFails(getDoc(doc(db, 'unknownCollection', 'doc-1')));
    await assertFails(setDoc(doc(db, 'unknownCollection', 'doc-1'), { data: 'test' }));
  });
});
