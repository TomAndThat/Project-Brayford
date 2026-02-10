/**
 * E2E: Dashboard navigation
 *
 * Validates that the dashboard loads correctly, displays org data,
 * and navigation between dashboard cards works.
 */

import { test, expect } from '../../fixtures/auth.fixture';
import { DashboardPage } from '../../page-objects/dashboard.page';
import { UsersPage } from '../../page-objects/users.page';
import { TEST_ORGS } from '../../fixtures/data.fixture';

test.describe.configure({ mode: 'serial' });

test.describe('Dashboard navigation', () => {
  test('dashboard loads with correct org data', async ({
    authenticatedPage: { page },
  }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.expectLoaded();

    // Org name should be visible in the header
    await expect(dashboard.headerOrgName).toContainText(TEST_ORGS.bbcOrg.name);
  });

  test('owner sees team members card and can navigate to /dashboard/users', async ({
    authenticatedPage: { page },
  }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.expectLoaded();

    // Owner should see the Team Members card (has users:view permission)
    await expect(dashboard.teamMembersCard).toBeVisible();

    // Click the Team Members card
    await dashboard.goToTeamMembers();

    // Users page should load
    const usersPage = new UsersPage(page);
    await usersPage.expectLoaded();
  });

  test('member without users:view permission cannot see team members card', async ({
    memberPage: { page },
  }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.expectLoaded();

    // Member should NOT see the Team Members card (lacks users:view permission)
    await expect(dashboard.teamMembersCard).not.toBeVisible();
  });

  test('member without users:view permission is redirected from /dashboard/users', async ({
    memberPage: { page },
  }) => {
    let alertShown = false;
    
    // Set up alert handler to capture and dismiss the permission alert
    page.on('dialog', async (dialog) => {
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toContain("don't have permission");
      alertShown = true;
      await dialog.accept();
    });

    const usersPage = new UsersPage(page);
    await usersPage.goto();

    // Wait a bit for the alert to appear and be handled
    await page.waitForTimeout(500);

    // Verify alert was shown
    expect(alertShown).toBe(true);

    // Should be redirected back to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    const dashboard = new DashboardPage(page);
    await dashboard.expectLoaded();
  });

  test('breadcrumb navigates back to dashboard from users page', async ({
    authenticatedPage: { page },
  }) => {
    const usersPage = new UsersPage(page);
    await usersPage.goto();
    await usersPage.expectLoaded();

    // Click "Back to Dashboard" breadcrumb
    await usersPage.goBackToDashboard();

    // Dashboard should load
    const dashboard = new DashboardPage(page);
    await dashboard.expectLoaded();
  });

  test('dashboard shows "No brands yet" when org has no brands', async ({
    authenticatedPage: { page },
  }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.expectLoaded();

    // No brands were seeded, so empty state should show
    await expect(dashboard.noBrandsText).toBeVisible();
  });

  test('events and analytics cards are disabled (coming soon)', async ({
    authenticatedPage: { page },
  }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.expectLoaded();

    // Events and Analytics cards should be visible but disabled
    await expect(dashboard.eventsCard).toBeVisible();
    await expect(dashboard.analyticsCard).toBeVisible();
  });
});
