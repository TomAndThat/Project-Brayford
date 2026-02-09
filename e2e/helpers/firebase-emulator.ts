/**
 * Firebase Emulator utilities for E2E tests.
 *
 * Provides connectivity checks, data clearing, and Firestore seeding
 * via the emulator REST APIs and firebase-admin SDK.
 */

export const EMULATOR_CONFIG = {
  auth: { host: 'localhost', port: 9099 },
  firestore: { host: 'localhost', port: 8080 },
  projectId: 'demo-brayford',
} as const;

/**
 * Check that both Auth and Firestore emulators are reachable.
 * Returns true only if both respond successfully.
 */
export async function checkEmulatorHealth(): Promise<boolean> {
  try {
    const [authOk, firestoreOk] = await Promise.all([
      fetch(`http://${EMULATOR_CONFIG.auth.host}:${EMULATOR_CONFIG.auth.port}`)
        .then((r) => r.ok)
        .catch(() => false),
      fetch(
        `http://${EMULATOR_CONFIG.firestore.host}:${EMULATOR_CONFIG.firestore.port}`,
      )
        .then(() => true) // Firestore emulator may return non-200 at root, but responds
        .catch(() => false),
    ]);

    return authOk && firestoreOk;
  } catch {
    return false;
  }
}

/**
 * Clear all Auth emulator accounts.
 */
export async function clearAuthEmulatorData(): Promise<void> {
  const url = `http://${EMULATOR_CONFIG.auth.host}:${EMULATOR_CONFIG.auth.port}/emulator/v1/projects/${EMULATOR_CONFIG.projectId}/accounts`;

  const response = await fetch(url, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(
      `Failed to clear Auth emulator data: ${response.status} ${response.statusText}`,
    );
  }
}

/**
 * Clear all Firestore emulator documents.
 */
export async function clearFirestoreEmulatorData(): Promise<void> {
  const url = `http://${EMULATOR_CONFIG.firestore.host}:${EMULATOR_CONFIG.firestore.port}/emulator/v1/projects/${EMULATOR_CONFIG.projectId}/databases/(default)/documents`;

  const response = await fetch(url, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(
      `Failed to clear Firestore emulator data: ${response.status} ${response.statusText}`,
    );
  }
}

/**
 * Clear all data from both Auth and Firestore emulators.
 * Call this between test files for full isolation.
 */
export async function clearAllEmulatorData(): Promise<void> {
  await Promise.all([
    clearAuthEmulatorData(),
    clearFirestoreEmulatorData(),
  ]);
}
