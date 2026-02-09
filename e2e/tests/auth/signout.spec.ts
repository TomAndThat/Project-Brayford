/**
 * E2E: Sign-out flow
 *
 * Validates that signing out redirects the user to /signin
 * and they can no longer access protected routes.
 */

import { test, expect } from '../../fixtures/auth.fixture';
import { DashboardPage } from '../../page-objects/dashboard.page';

test.describe('Sign-out', () => {
  test('user can sign out from dashboard and is redirected to /signin', async ({
    authenticatedPage: { page },
  }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.expectLoaded();

    // Sign out via the header dropdown
    await dashboard.signOut();

    // Should redirect to sign-in page
    await page.waitForURL('**/signin');
    await expect(
      page.getByRole('heading', { name: 'Get Started' }),
    ).toBeVisible();
  });

  test('after sign-out, visiting /dashboard redirects to /signin', async ({
    authenticatedPage: { page },
  }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.expectLoaded();

    // Sign out
    await dashboard.signOut();
    await page.waitForURL('**/signin');

    // Try to visit dashboard again
    await page.goto('/dashboard');
    await page.waitForURL('**/signin');
  });
});
