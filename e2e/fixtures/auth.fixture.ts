/**
 * Authenticated user fixture for Playwright tests.
 *
 * Extends the base Playwright test with an `authenticatedPage` fixture
 * that automatically creates a test user, signs them in, and provides
 * a pre-authenticated browser page.
 *
 * Usage:
 *   import { test, expect } from '../fixtures/auth.fixture';
 *
 *   test('dashboard loads', async ({ authenticatedPage }) => {
 *     await authenticatedPage.page.goto('/dashboard');
 *     // ... user is already signed in
 *   });
 */

import { test as base, type Page } from '@playwright/test';
import { createTestUser, signInAsTestUser } from '../helpers/auth-helpers';
import { seedCompleteOrganization } from '../helpers/firestore-seed';
import { clearAllEmulatorData } from '../helpers/firebase-emulator';
import { TEST_USERS, TEST_ORGS } from './data.fixture';

interface AuthenticatedPage {
  page: Page;
  uid: string;
  email: string;
  displayName: string;
}

interface AuthFixtures {
  /** A page pre-authenticated as the test owner user, with a seeded org */
  authenticatedPage: AuthenticatedPage;

  /** A page pre-authenticated as a new user with no organization */
  newUserPage: AuthenticatedPage;

  /** A page pre-authenticated as a member user (no users:view permission) */
  memberPage: AuthenticatedPage;
}

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Clear previous test data
    await clearAllEmulatorData();

    // Create user in Auth Emulator
    const { email, displayName } = TEST_USERS.owner;
    const uid = await createTestUser(email, displayName);

    // Seed Firestore with org + membership
    await seedCompleteOrganization({
      orgId: TEST_ORGS.bbcOrg.id,
      orgName: TEST_ORGS.bbcOrg.name,
      orgType: TEST_ORGS.bbcOrg.type,
      billingEmail: TEST_ORGS.bbcOrg.billingEmail,
      ownerUid: uid,
      ownerEmail: email,
      ownerDisplayName: displayName,
    });

    // Navigate to the app and sign in
    await page.goto('/');
    await signInAsTestUser(page, uid);

    await use({ page, uid, email, displayName });
  },

  newUserPage: async ({ page }, use) => {
    // Clear previous test data
    await clearAllEmulatorData();

    // Create user in Auth Emulator but do NOT seed any org
    const { email, displayName } = TEST_USERS.newUser;
    const uid = await createTestUser(email, displayName);

    // Navigate to the app and sign in
    await page.goto('/');
    await signInAsTestUser(page, uid);

    await use({ page, uid, email, displayName });
  },

  memberPage: async ({ page }, use) => {
    // Clear previous test data
    await clearAllEmulatorData();

    // Create member user in Auth Emulator
    const { email, displayName } = TEST_USERS.member;
    const uid = await createTestUser(email, displayName);

    // Create a separate owner user for this test org
    const ownerUid = await createTestUser('owner-for-member-test@test.com', 'Member Test Owner');

    // Seed org with owner + member (member role has no users:view permission)
    await seedCompleteOrganization({
      orgId: TEST_ORGS.bbcOrg.id,
      orgName: TEST_ORGS.bbcOrg.name,
      orgType: TEST_ORGS.bbcOrg.type,
      billingEmail: TEST_ORGS.bbcOrg.billingEmail,
      ownerUid,
      ownerEmail: 'owner-for-member-test@test.com',
      ownerDisplayName: 'Member Test Owner',
    });

    // Add member to the organization
    const { seedUser, seedOrganizationMember } = await import('../helpers/firestore-seed');
    const memberId = `${TEST_ORGS.bbcOrg.id}_${uid}`;
    
    await seedUser(uid, { email, displayName });
    await seedOrganizationMember(memberId, {
      organizationId: TEST_ORGS.bbcOrg.id,
      userId: uid,
      role: 'member',
      brandAccess: [],
      autoGrantNewBrands: false,
    });

    // Navigate to the app and sign in as member
    await page.goto('/');
    await signInAsTestUser(page, uid);

    await use({ page, uid, email, displayName });
  },
});

export { expect } from '@playwright/test';
