/**
 * Authentication exports
 * Phase 1: Google OAuth only
 */

export {
  signInWithGoogle,
  signOut,
  onAuthChange,
  getCurrentUser,
  getCurrentUserId,
  isAuthenticated,
  waitForAuth,
} from './google';
