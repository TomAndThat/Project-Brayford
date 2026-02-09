import { clearAllEmulatorData } from './helpers/firebase-emulator';

/**
 * Playwright global teardown.
 *
 * Clears all emulator data after the full test run to leave
 * emulators in a clean state.
 */
async function globalTeardown(): Promise<void> {
  console.log('\n🧹 Clearing emulator data...');
  await clearAllEmulatorData();
  console.log('✅ Emulator data cleared.\n');
}

export default globalTeardown;
