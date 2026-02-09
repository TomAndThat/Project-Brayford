/**
 * Firebase Admin SDK - Server-Side Configuration
 * 
 * Used by Next.js API routes (Route Handlers) for server-side operations
 * that require elevated privileges or atomic guarantees.
 * 
 * This module uses the Admin SDK which:
 * - Bypasses Firestore security rules (trusted server context)
 * - Can verify Firebase ID tokens
 * - Supports batch writes and transactions
 * 
 * Environment variables:
 * - NEXT_PUBLIC_FIREBASE_PROJECT_ID (already set)
 * - FIREBASE_CLIENT_EMAIL (service account email)
 * - FIREBASE_PRIVATE_KEY (service account private key)
 * 
 * In development/emulator mode, initializes without credentials.
 */

import {
  initializeApp,
  getApps,
  cert,
  type App,
} from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * Initialize Firebase Admin (singleton)
 * 
 * Uses application default credentials in production (via service account),
 * or project ID only for emulator mode.
 */
function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  // If service account credentials are available, use them
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Private key comes as an escaped string from env, need to unescape newlines
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }

  // Emulator/development mode — no credentials needed
  return initializeApp({ projectId });
}

const adminApp = getAdminApp();

/**
 * Firebase Admin Auth instance
 * Used for verifying ID tokens from client requests
 */
export const adminAuth: Auth = getAuth(adminApp);

/**
 * Firebase Admin Firestore instance
 * Used for server-side batch writes and transactions
 */
export const adminDb: Firestore = getFirestore(adminApp);

/**
 * Verify a Firebase ID token from a client request
 * 
 * @param idToken - The raw ID token string from the Authorization header
 * @returns Decoded token with uid, email, etc.
 * @throws If the token is invalid, expired, or revoked
 */
export async function verifyIdToken(idToken: string) {
  return adminAuth.verifyIdToken(idToken);
}
