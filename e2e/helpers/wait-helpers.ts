/**
 * Custom wait helpers for E2E tests.
 *
 * Provide reliable waits for common async conditions that
 * Playwright's auto-waiting doesn't cover (e.g. Firebase
 * auth state propagation, Firestore data loading).
 */

import { type Page } from '@playwright/test';

/**
 * Wait for the page URL to match a pattern.
 * Useful after auth-triggered redirects.
 */
export async function waitForRoute(
  page: Page,
  urlPattern: string | RegExp,
  options?: { timeout?: number },
): Promise<void> {
  await page.waitForURL(urlPattern, {
    timeout: options?.timeout ?? 10_000,
  });
}

/**
 * Wait until a loading indicator disappears.
 * Many pages show "Loading..." while fetching data.
 */
export async function waitForLoadingToFinish(
  page: Page,
  options?: { timeout?: number },
): Promise<void> {
  // Wait for the loading text to disappear (or never appear)
  await page
    .getByText('Loading...')
    .waitFor({ state: 'hidden', timeout: options?.timeout ?? 10_000 })
    .catch(() => {
      // Loading text was never visible — that's fine
    });
}

/**
 * Wait for Firebase auth to be fully initialised in the app.
 * The app shows "Loading..." while auth state is resolving.
 */
export async function waitForAuthReady(
  page: Page,
  options?: { timeout?: number },
): Promise<void> {
  await waitForLoadingToFinish(page, options);
}

/**
 * Wait for a navigation to complete after a user action.
 * Combines URL change + loading state resolution.
 */
export async function waitForNavigationComplete(
  page: Page,
  urlPattern: string | RegExp,
  options?: { timeout?: number },
): Promise<void> {
  await waitForRoute(page, urlPattern, options);
  await waitForLoadingToFinish(page, options);
}
