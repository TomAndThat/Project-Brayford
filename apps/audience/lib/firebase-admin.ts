/**
 * Firebase Admin SDK - Server-Side Configuration (Audience App)
 *
 * Used by Next.js API routes (Route Handlers) for server-side operations
 * that require elevated privileges. The audience app uses this for session
 * management — audience members are not Firebase Auth users, so operations
 * on their behalf must bypass Firestore security rules.
 *
 * This module uses the Admin SDK which:
 * - Bypasses Firestore security rules (trusted server context)
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
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * Initialize Firebase Admin (singleton)
 *
 * Uses service account credentials in production,
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
 * Firebase Admin Firestore instance
 * Used for server-side reads and writes that bypass security rules
 */
export const adminDb: Firestore = getFirestore(adminApp);
