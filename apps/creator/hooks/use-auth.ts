'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthChange, signInWithGoogle, signOut, db } from '@brayford/firebase-utils';
import { doc, onSnapshot } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';

export interface UseAuthReturn {
  user: FirebaseUser | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

/**
 * Auth hook for Firebase authentication
 * Provides current user state, loading state, and auth methods.
 *
 * Also watches the user's Firestore document for `claimsVersion` changes
 * and forces a token refresh when custom claims are updated by Cloud Functions.
 * This ensures the client always has the latest permissions in the auth token.
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, loading, signIn, signOut } = useAuth();
 *   
 *   if (loading) return <div>Loading...</div>;
 *   
 *   if (!user) {
 *     return <button onClick={signIn}>Sign In</button>;
 *   }
 *   
 *   return (
 *     <div>
 *       <p>Welcome, {user.displayName}!</p>
 *       <button onClick={signOut}>Sign Out</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Track the last-seen claimsVersion to detect changes (not initial load)
  const claimsVersionRef = useRef<number | null>(null);

  useEffect(() => {
    // Subscribe to auth state changes
    // Don't use getCurrentUser() here — Firebase may not have
    // restored the session from persistence yet.
    // onAuthChange fires once on init with the real state.
    const unsubscribe = onAuthChange((firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Watch user doc for claimsVersion changes → force token refresh
  useEffect(() => {
    if (!user) {
      claimsVersionRef.current = null;
      return;
    }

    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (snapshot) => {
      const data = snapshot.data();
      if (!data) return;

      const newVersion = (data.claimsVersion as number) ?? 0;
      const previousVersion = claimsVersionRef.current;

      if (previousVersion !== null && newVersion > previousVersion) {
        // claimsVersion bumped — force token refresh to pick up new claims
        user.getIdToken(true).catch((err) => {
          console.error('Failed to refresh auth token after claims update:', err);
        });
      }

      claimsVersionRef.current = newVersion;
    }, (error) => {
      // Don't crash the app if the snapshot fails
      console.error('Failed to watch user document for claims changes:', error);
    });

    return unsubscribe;
  }, [user]);

  const handleSignIn = useCallback(async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Sign-in failed:', error);
      throw error;
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign-out failed:', error);
      throw error;
    }
  }, []);

  return {
    user,
    loading,
    signIn: handleSignIn,
    signOut: handleSignOut,
  };
}
