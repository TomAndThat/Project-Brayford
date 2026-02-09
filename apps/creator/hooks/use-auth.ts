'use client';

import { useEffect, useState } from 'react';
import { onAuthChange, signInWithGoogle, signOut, getCurrentUser } from '@brayford/firebase-utils';
import type { User as FirebaseUser } from 'firebase/auth';

export interface UseAuthReturn {
  user: FirebaseUser | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

/**
 * Auth hook for Firebase authentication
 * Provides current user state, loading state, and auth methods
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

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Sign-in failed:', error);
      throw error;
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign-out failed:', error);
      throw error;
    }
  };

  return {
    user,
    loading,
    signIn: handleSignIn,
    signOut: handleSignOut,
  };
}
