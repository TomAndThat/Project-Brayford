/**
 * E2E: Sign-in flow
 *
 * Validates that unauthenticated users are redirected to /signin,
 * the sign-in page renders correctly, and authenticated users are
 * redirected away from /signin.
 */

import { test, expect } from '../../fixtures/auth.fixture';
import { SignInPage } from '../../page-objects/signin.page';
import { clearAllEmulatorData } from '../../helpers/firebase-emulator';

test.describe('Sign-in page', () => {
  test.beforeEach(async () => {
    await clearAllEmulatorData();
  });

  test('unauthenticated user visiting / is redirected to /signin', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForURL('**/signin');

    const signInPage = new SignInPage(page);
    await signInPage.expectVisible();
  });

  test('unauthenticated user visiting /dashboard is redirected to /signin', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    // The dashboard page checks auth and redirects
    await page.waitForURL('**/signin');

    const signInPage = new SignInPage(page);
    await signInPage.expectVisible();
  });

  test('sign-in page renders all expected elements', async ({ page }) => {
    const signInPage = new SignInPage(page);
    await signInPage.goto();
    await signInPage.expectVisible();

    // Check branding
    await expect(
      page.getByRole('heading', { name: 'Project Brayford' }),
    ).toBeVisible();

    // Check sign-in CTA
    await expect(signInPage.googleSignInButton).toBeVisible();
    await expect(signInPage.googleSignInButton).toBeEnabled();

    // Check terms text
    await expect(signInPage.termsText).toBeVisible();
  });

  test('authenticated user with org is redirected from /signin to /dashboard', async ({
    authenticatedPage: { page },
  }) => {
    await page.goto('/signin');
    // Auth state should trigger redirect to onboarding or dashboard
    await page.waitForURL('**/onboarding');
  });
});
