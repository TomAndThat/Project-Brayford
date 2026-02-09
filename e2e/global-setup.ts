import { checkEmulatorHealth } from './helpers/firebase-emulator';

/**
 * Playwright global setup.
 *
 * Verifies Firebase emulators are running before any tests execute.
 * Emulators must be started separately (e.g. `firebase emulators:start`).
 */
async function globalSetup(): Promise<void> {
  console.log('\n🔌 Checking Firebase emulator connectivity...');

  const healthy = await checkEmulatorHealth();

  if (!healthy) {
    throw new Error(
      [
        'Firebase emulators are not running.',
        '',
        'Start them before running E2E tests:',
        '  firebase emulators:start --only auth,firestore --project demo-brayford',
        '',
        'Or run them in the background:',
        '  firebase emulators:start --only auth,firestore --project demo-brayford &',
      ].join('\n'),
    );
  }

  console.log('✅ Firebase emulators are ready.\n');
}

export default globalSetup;
