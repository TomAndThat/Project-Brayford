/**
 * E2E: Invite user flow
 *
 * Validates the invite modal and invitation creation from
 * the team members page.
 *
 * NOTE: The invite modal is implemented but not yet wired into
 * the users page (the button currently calls alert()). These
 * tests are deferred until wiring is complete.
 */

import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Invite user', () => {
  test.skip(
    true,
    'Invite modal not yet wired into users page — see INVITATION_SYSTEM brief',
  );

  test('admin opens invite modal from users page', async ({ page }) => {
    // TODO: Navigate to /dashboard/users
    // TODO: Click "Invite User" button
    // TODO: Assert modal is visible with email input, role selection
  });

  test('admin fills form and sends invitation', async ({ page }) => {
    // TODO: Open invite modal
    // TODO: Fill email, select role
    // TODO: Submit
    // TODO: Assert success message
    // TODO: Verify invitation created in Firestore
  });

  test('duplicate invitation shows resend option', async ({ page }) => {
    // TODO: Create existing pending invitation
    // TODO: Try to invite same email
    // TODO: Assert resend prompt appears
  });
});
