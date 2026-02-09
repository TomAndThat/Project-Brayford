/**
 * E2E: Onboarding — Accept Invitation (Flow B)
 *
 * Validates the invitation acceptance flow where a new user
 * clicks an invite link and joins an existing organisation.
 *
 * NOTE: These tests are deferred until the invitation acceptance
 * UI is implemented. The spec structure is in place so tests can
 * be filled in without restructuring.
 */

import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Onboarding — Accept Invitation', () => {
  test.skip(
    true,
    'Invitation acceptance UI not yet implemented — see INVITATION_SYSTEM brief',
  );

  test('new user clicks invite link and sees invitation page', async ({
    page,
  }) => {
    // TODO: Navigate to /invite?token=xxx
    // TODO: Assert invitation details are displayed
  });

  test('new user authenticates and joins org via invitation', async ({
    page,
  }) => {
    // TODO: Create invitation in Firestore
    // TODO: Navigate to invite link
    // TODO: Sign in
    // TODO: Assert user lands on dashboard with correct org
  });

  test('existing user accepts invite and gains org membership', async ({
    page,
  }) => {
    // TODO: Create invitation for existing user
    // TODO: Sign in as that user
    // TODO: Navigate to invite link
    // TODO: Assert org is added to user's memberships
  });

  test('expired invitation token shows error', async ({ page }) => {
    // TODO: Create expired invitation
    // TODO: Navigate to invite link
    // TODO: Assert error message is shown
  });

  test('email mismatch shows error', async ({ page }) => {
    // TODO: Create invitation for email-a@test.com
    // TODO: Sign in as email-b@test.com
    // TODO: Navigate to invite link
    // TODO: Assert email mismatch error
  });
});
