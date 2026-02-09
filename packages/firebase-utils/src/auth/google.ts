/**
 * Authentication Helpers - Google OAuth
 * 
 * Phase 1: Google OAuth only
 * Email/password and other providers deferred to post-MVP (see ROADMAP.md)
 * 
 * Handles:
 * - Google sign-in with popup
 * - Sign out
 * - Auth state observation
 * - User creation in Firestore on first sign-in
 */

import {
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User as FirebaseUser,
  type UserCredential,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config';
import {
  validateCreateUserData,
  type CreateUserData,
  type User,
  toBranded,
  type UserId,
} from '@brayford/core';

/**
 * Google OAuth provider instance
 * Configured for Phase 1 authentication
 */
const googleProvider = new GoogleAuthProvider();

// Configure Google provider to always show account selection
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

/**
 * Convert Firebase User to our User schema format
 * 
 * @param firebaseUser - Firebase Auth user object
 * @returns CreateUserData ready for Firestore
 */
function firebaseUserToCreateData(firebaseUser: FirebaseUser): CreateUserData {
  const userData: CreateUserData = {
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
    photoURL: firebaseUser.photoURL,
    authProvider: 'google.com',
  };

  // Validate with schema before returning
  return validateCreateUserData(userData);
}

/**
 * Create or update user document in Firestore
 * Called after successful authentication
 * 
 * @param firebaseUser - Firebase Auth user object
 * @returns Promise that resolves when user document is created/updated
 */
async function createOrUpdateUserDocument(firebaseUser: FirebaseUser): Promise<void> {
  const userRef = doc(db, 'users', firebaseUser.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    // New user: create document
    const userData = firebaseUserToCreateData(firebaseUser);
    
    await setDoc(userRef, {
      ...userData,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    });
  } else {
    // Existing user: update last login
    await setDoc(
      userRef,
      {
        lastLoginAt: serverTimestamp(),
        // Update profile info in case it changed in Google
        displayName: firebaseUser.displayName || userSnap.data().displayName,
        photoURL: firebaseUser.photoURL ?? userSnap.data().photoURL,
      },
      { merge: true }
    );
  }
}

/**
 * Sign in with Google using popup
 * Creates/updates user document in Firestore on success
 * 
 * @returns Promise resolving to UserCredential
 * @throws Error if sign-in fails
 * 
 * @example
 * ```tsx
 * async function handleSignIn() {
 *   try {
 *     await signInWithGoogle();
 *     router.push('/dashboard');
 *   } catch (error) {
 *     console.error('Sign-in failed:', error);
 *     showErrorToast('Could not sign in. Please try again.');
 *   }
 * }
 * ```
 */
export async function signInWithGoogle(): Promise<UserCredential> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    
    // Create/update user document in Firestore
    await createOrUpdateUserDocument(result.user);
    
    return result;
  } catch (error) {
    // Re-throw with more context
    console.error('Google sign-in failed:', error);
    throw new Error('Failed to sign in with Google. Please try again.');
  }
}

/**
 * Sign out current user
 * 
 * @returns Promise that resolves when sign-out is complete
 * 
 * @example
 * ```tsx
 * async function handleSignOut() {
 *   await signOut();
 *   router.push('/');
 * }
 * ```
 */
export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Sign-out failed:', error);
    throw new Error('Failed to sign out. Please try again.');
  }
}

/**
 * Subscribe to auth state changes
 * 
 * @param callback - Function called when auth state changes
 * @returns Unsubscribe function
 * 
 * @example
 * ```tsx
 * useEffect(() => {
 *   const unsubscribe = onAuthChange((user) => {
 *     if (user) {
 *       console.log('User signed in:', user.uid);
 *     } else {
 *       console.log('User signed out');
 *     }
 *   });
 *   
 *   return unsubscribe; // Cleanup on unmount
 * }, []);
 * ```
 */
export function onAuthChange(
  callback: (user: FirebaseUser | null) => void
): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * Get current authenticated user
 * Returns null if not signed in
 * 
 * @returns Current Firebase user or null
 * 
 * @example
 * ```tsx
 * const user = getCurrentUser();
 * if (user) {
 *   console.log('Signed in as:', user.email);
 * }
 * ```
 */
export function getCurrentUser(): FirebaseUser | null {
  return auth.currentUser;
}

/**
 * Check if user is currently authenticated
 * 
 * @returns True if user is signed in
 * 
 * @example
 * ```tsx
 * if (isAuthenticated()) {
 *   // Show authenticated content
 * } else {
 *   // Show sign-in prompt
 * }
 * ```
 */
export function isAuthenticated(): boolean {
  return auth.currentUser !== null;
}

/**
 * Get current user's ID as branded type
 * Returns null if not authenticated
 * 
 * @returns UserId or null
 * 
 * @example
 * ```tsx
 * const userId = getCurrentUserId();
 * if (userId) {
 *   const userDoc = await getUser(userId);
 * }
 * ```
 */
export function getCurrentUserId(): UserId | null {
  const user = auth.currentUser;
  return user ? toBranded<UserId>(user.uid) : null;
}

/**
 * Wait for auth to initialize
 * Useful for checking auth state on app startup
 * 
 * @param timeoutMs - Maximum time to wait (default: 5000ms)
 * @returns Promise resolving to current user or null
 * 
 * @example
 * ```tsx
 * // In app layout or root component
 * useEffect(() => {
 *   waitForAuth().then((user) => {
 *     if (user) {
 *       router.push('/dashboard');
 *     } else {
 *       router.push('/signin');
 *     }
 *   });
 * }, []);
 * ```
 */
export function waitForAuth(timeoutMs: number = 5000): Promise<FirebaseUser | null> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Auth initialization timeout'));
    }, timeoutMs);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      clearTimeout(timeout);
      unsubscribe();
      resolve(user);
    });
  });
}
