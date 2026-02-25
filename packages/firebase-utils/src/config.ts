/**
 * Firebase Configuration and Initialization
 * 
 * This module initializes Firebase app, Auth, and Firestore instances.
 * Configuration is loaded from environment variables.
 * 
 * Environment variables required (set in each app's .env.local):
 * - NEXT_PUBLIC_FIREBASE_API_KEY
 * - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 * - NEXT_PUBLIC_FIREBASE_PROJECT_ID
 * - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET (not required in emulator mode)
 * - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID (not required in emulator mode)
 * - NEXT_PUBLIC_FIREBASE_APP_ID (not required in emulator mode)
 * 
 * Emulator support:
 * - Set NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true to connect Firestore and Storage to local emulators
 * - Set NEXT_PUBLIC_FIREBASE_AUTH_USE_EMULATOR=true to connect Auth to the local emulator
 * - Auth emulator: localhost:9099
 * - Firestore emulator: localhost:8080
 * - Storage emulator: localhost:9199
 *
 * Day-to-day development uses production Firebase (all flags false/omitted).
 * Only enable emulators for E2E testing or isolated Cloud Functions work.
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithCustomToken, type Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { getStorage, connectStorageEmulator, type FirebaseStorage } from 'firebase/storage';

/** Whether Firestore and Storage should connect to local emulators */
const isFirestoreEmulatorMode = process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === 'true';

/** Whether Auth should connect to the local emulator */
const isAuthEmulatorMode = process.env.NEXT_PUBLIC_FIREBASE_AUTH_USE_EMULATOR === 'true';

/**
 * Firebase configuration object
 * Loaded from environment variables with NEXT_PUBLIC_ prefix
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Config keys required in each mode.
 * In emulator mode, only core keys are required — storageBucket,
 * messagingSenderId, and appId are unnecessary.
 */
const EMULATOR_REQUIRED_KEYS: (keyof typeof firebaseConfig)[] = [
  'apiKey',
  'authDomain',
  'projectId',
];

/**
 * Validate Firebase configuration
 * In emulator mode, only core keys are required.
 * In production mode, all keys are required.
 */
const ENV_VAR_NAMES: Record<keyof typeof firebaseConfig, string> = {
  apiKey: 'NEXT_PUBLIC_FIREBASE_API_KEY',
  authDomain: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  projectId: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  storageBucket: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'NEXT_PUBLIC_FIREBASE_APP_ID',
};

function validateConfig(): void {
  const requiredKeys = isFirestoreEmulatorMode
    ? EMULATOR_REQUIRED_KEYS
    : (Object.keys(firebaseConfig) as (keyof typeof firebaseConfig)[]);

  const missingKeys = requiredKeys.filter((key) => !firebaseConfig[key]);

  if (missingKeys.length > 0) {
    throw new Error(
      `Missing Firebase configuration. Please set the following environment variables:\n${missingKeys
        .map((key) => ENV_VAR_NAMES[key])
        .join('\n')}`
    );
  }
}

// Validate config on import
validateConfig();

/**
 * Initialize Firebase app (singleton pattern)
 * Only initializes once, even if imported multiple times
 */
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0]!;
}

/**
 * Firebase Auth instance
 * Used for authentication operations (sign in, sign out, etc.)
 */
export const auth: Auth = getAuth(app);

/**
 * Firestore database instance
 * Used for all database operations
 */
export const db: Firestore = getFirestore(app);

/**
 * Firebase Storage instance
 * Used for file upload/download operations (brand images, etc.)
 */
export const storage: FirebaseStorage = getStorage(app);

/**
 * Firebase app instance
 * Exposed for advanced use cases
 */
export const firebaseApp: FirebaseApp = app;

/**
 * Export Firebase config for debugging/testing
 * Note: Safe to expose as these are all NEXT_PUBLIC_ variables
 */
export { firebaseConfig };

/**
 * Emulator connections for local development and E2E testing.
 *
 * NEXT_PUBLIC_FIREBASE_USE_EMULATORS=false  → Firestore (8080) + Storage (9199)
 * NEXT_PUBLIC_FIREBASE_AUTH_USE_EMULATOR=true → Auth (9099)
 *
 * The two flags are independent. The admin app, for example, omits the Auth
 * flag so that real production accounts can be used while Firestore data stays
 * local. When Auth emulator is active, a __FIREBASE_TEST__ global is exposed
 * for Playwright to sign in via signInWithCustomToken.
 */
if (isAuthEmulatorMode) {
  connectAuthEmulator(auth, 'http://localhost:9099');
}

if (isFirestoreEmulatorMode) {
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectStorageEmulator(storage, 'localhost', 9199);
}

if (isAuthEmulatorMode && typeof window !== 'undefined') {
  (window as Record<string, unknown>).__FIREBASE_TEST__ = {
    signIn: (token: string) => signInWithCustomToken(auth, token),
  };
}
