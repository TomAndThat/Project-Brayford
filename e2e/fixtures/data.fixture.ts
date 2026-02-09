/**
 * Test data constants for E2E tests.
 *
 * Provides consistent, reusable seed data for organizations,
 * users, and brands. IDs are deterministic so tests can reference
 * them directly.
 */

export const TEST_ORGS = {
  bbcOrg: {
    id: 'test-org-bbc',
    name: 'BBC Test Org',
    type: 'team' as const,
    billingEmail: 'billing@bbc-test.com',
  },
  soloCreator: {
    id: 'test-org-solo',
    name: 'Jane Smith Productions',
    type: 'individual' as const,
    billingEmail: 'jane@test.com',
  },
} as const;

export const TEST_USERS = {
  owner: {
    email: 'owner@test.com',
    displayName: 'Test Owner',
  },
  admin: {
    email: 'admin@test.com',
    displayName: 'Test Admin',
  },
  member: {
    email: 'member@test.com',
    displayName: 'Test Member',
  },
  newUser: {
    email: 'new@test.com',
    displayName: 'New User',
  },
} as const;

export const TEST_BRANDS = {
  mainBrand: {
    id: 'test-brand-main',
    name: 'BBC Radio 1',
    description: 'The UK\'s number one youth station',
  },
  secondBrand: {
    id: 'test-brand-second',
    name: 'BBC Radio 2',
    description: 'The UK\'s most listened-to station',
  },
} as const;
