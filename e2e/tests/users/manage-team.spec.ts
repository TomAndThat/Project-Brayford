/**
 * E2E: Team members management
 *
 * Validates the team members list, role display, and
 * permission-based action visibility.
 */

import { test, expect } from '../../fixtures/auth.fixture';
import { UsersPage } from '../../page-objects/users.page';

test.describe('Team members management', () => {
  test('users page loads and shows current user', async ({
    authenticatedPage: { page, displayName },
  }) => {
    const usersPage = new UsersPage(page);
    await usersPage.goto();
    await usersPage.expectLoaded();

    // With only one member (the owner), the solo state should show
    await expect(usersPage.soloState).toBeVisible();
    await expect(usersPage.rolesInfoBox).toBeVisible();
  });

  test('owner sees invite button', async ({
    authenticatedPage: { page },
  }) => {
    const usersPage = new UsersPage(page);
    await usersPage.goto();
    await usersPage.expectLoaded();

    // Owner should have invite permissions
    await expect(usersPage.inviteUserButton).toBeVisible();
  });

  test('roles info box explains permission levels', async ({
    authenticatedPage: { page },
  }) => {
    const usersPage = new UsersPage(page);
    await usersPage.goto();
    await usersPage.expectLoaded();

    // Info box should explain the three roles
    await expect(usersPage.rolesInfoBox).toContainText('Owner');
    await expect(usersPage.rolesInfoBox).toContainText('Admin');
    await expect(usersPage.rolesInfoBox).toContainText('Member');
  });
});
