/**
 * @brayford/firebase-utils
 * 
 * Firebase utilities and helpers for Project Brayford
 * Handles Firebase initialization, auth, Firestore operations, and real-time hooks
 */

// Firebase initialization and config
export { auth, db, firebaseApp, firebaseConfig } from './config';

// Authentication (Phase 1: Google OAuth only)
export * from './auth';

// Firestore operations
export * from './firestore';

// Jitter utility for concurrent write protection
export {
  withJitter,
  createJittered,
  batchWithJitter,
  shouldUseJitter,
  type JitterOptions,
} from './jitter';
