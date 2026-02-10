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

  test('owner can invite another owner with confirmation', async ({ page }) => {
    // TODO: Navigate to /dashboard/users as owner
    // TODO: Click "Invite User" button
    // TODO: Fill email with new owner email
    // TODO: Select "Owner" role
    // TODO: Assert warning banner appears about owner permissions
    // TODO: Click "Send Invitation"
    // TODO: Assert confirmation dialog appears
    // TODO: Confirm invitation
    // TODO: Assert success message
    // TODO: Verify invitation created with role='owner'
  });

  test('admin cannot see owner role option', async ({ page }) => {
    // TODO: Navigate to /dashboard/users as admin
    // TODO: Click "Invite User" button
    // TODO: Assert "Owner" role button is disabled or hidden
    // TODO: Verify tooltip/title says only owners can invite owners
  });

  test('owner can cancel owner invitation in confirmation dialog', async ({ page }) => {
    // TODO: Navigate to /dashboard/users as owner
    // TODO: Open invite modal and select owner role
    // TODO: Enter email and submit
    // TODO: Assert confirmation dialog appears
    // TODO: Click "Cancel"
    // TODO: Assert dialog closes and no invitation created
  });
});
