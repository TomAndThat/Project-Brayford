/**
 * Auth helpers for E2E tests.
 *
 * Uses firebase-admin SDK to create test users and generate custom
 * tokens against the Auth Emulator. The admin SDK auto-connects to
 * the emulator when FIREBASE_AUTH_EMULATOR_HOST is set (configured
 * in playwright.config.ts).
 *
 * The 'demo-' project prefix ensures firebase-admin works in emulator
 * mode without real GCP credentials.
 */

import { type Page } from '@playwright/test';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Singleton admin app — initialise once
if (getApps().length === 0) {
  initializeApp({ projectId: 'demo-brayford' });
}

const adminAuth = getAuth();

/**
 * Create a test user in the Auth Emulator.
 * Returns the user's uid.
 */
export async function createTestUser(
  email: string,
  displayName: string,
): Promise<string> {
  const user = await adminAuth.createUser({
    email,
    displayName,
    emailVerified: true,
  });
  return user.uid;
}

/**
 * Generate a custom auth token for the given uid.
 * Used with signInWithCustomToken in the browser context.
 */
export async function createCustomToken(uid: string): Promise<string> {
  return adminAuth.createCustomToken(uid);
}

/**
 * Sign in as a test user in the browser.
 *
 * 1. Generates a custom token via firebase-admin
 * 2. Injects it into the page via the __FIREBASE_TEST__ global
 *    (exposed by firebase-utils config.ts in emulator mode)
 * 3. Waits for the auth state to propagate to the React app
 */
export async function signInAsTestUser(
  page: Page,
  uid: string,
): Promise<void> {
  const token = await createCustomToken(uid);

  await page.evaluate(async (t: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const helpers = (window as any).__FIREBASE_TEST__ as
      | { signIn: (token: string) => Promise<unknown> }
      | undefined;

    if (!helpers) {
      throw new Error(
        '__FIREBASE_TEST__ not found on window. ' +
          'Is NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true set?',
      );
    }

    await helpers.signIn(t);
  }, token);

  // Wait for the auth state observer in useAuth() to fire and
  // trigger a React re-render / navigation
  await page.waitForTimeout(1000);
}

/**
 * Delete a specific user from the Auth Emulator.
 */
export async function deleteTestUser(uid: string): Promise<void> {
  await adminAuth.deleteUser(uid);
}
