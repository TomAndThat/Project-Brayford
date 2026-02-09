import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Project Brayford E2E tests.
 *
 * Runs the creator app against Firebase emulators.
 * See docs/briefs/E2E_TESTING_PLAYWRIGHT.md for full details.
 */

/** Environment variables for Firebase emulators */
const EMULATOR_ENV = {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'test-api-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'localhost',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-brayford',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-brayford.appspot.com',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000',
  NEXT_PUBLIC_FIREBASE_USE_EMULATORS: 'true',
  FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099',
  FIRESTORE_EMULATOR_HOST: 'localhost:8080',
};

// Make emulator env available to Node.js test helpers (firebase-admin)
process.env.FIREBASE_AUTH_EMULATOR_HOST = EMULATOR_ENV.FIREBASE_AUTH_EMULATOR_HOST;
process.env.FIRESTORE_EMULATOR_HOST = EMULATOR_ENV.FIRESTORE_EMULATOR_HOST;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['html', { open: 'on-failure' }]],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Phase 2: Add Firefox, Safari, mobile viewports
  ],

  /**
   * Start the creator app dev server before tests.
   * The webServer inherits EMULATOR_ENV so the app connects to
   * Firebase emulators instead of production.
   */
  webServer: {
    command: 'pnpm --filter creator dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: EMULATOR_ENV,
  },

  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
});
