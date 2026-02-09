import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock auth object that can be mutated in tests - must be hoisted
const mockAuth = vi.hoisted(() => ({
  currentUser: null as any,
}));

// Mock Firebase App
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: 'test-app' })),
  getApps: vi.fn(() => []),
}));

// Mock Firebase Auth
vi.mock('firebase/auth', () => {
  const MockGoogleAuthProvider = vi.fn(function(this: any) {
    this.setCustomParameters = vi.fn();
    return this;
  });
  
  return {
    getAuth: vi.fn(() => mockAuth),
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn(),
    GoogleAuthProvider: MockGoogleAuthProvider,
  };
});

// Mock Firebase Firestore  
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({ _isFirestore: true })),
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
}));

import {
  signInWithGoogle,
  signOut,
  onAuthChange,
  getCurrentUser,
  isAuthenticated,
  getCurrentUserId,
  waitForAuth,
} from '../google';
import type { User as FirebaseUser } from 'firebase/auth';
import { toBranded, type UserId } from '@brayford/core';

import { signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';
import { getDoc, setDoc } from 'firebase/firestore';

// Helper to create mock Firebase user
function createMockFirebaseUser(overrides?: Partial<FirebaseUser>): FirebaseUser {
  return {
    uid: 'test-uid-123',
    email: 'test@example.com',
    displayName: 'Test User',
    photoURL: 'https://example.com/photo.jpg',
    emailVerified: true,
    isAnonymous: false,
    metadata: {
      creationTime: '2024-01-01T00:00:00Z',
      lastSignInTime: '2024-01-15T10:00:00Z',
    },
    providerData: [],
    refreshToken: 'mock-refresh-token',
    tenantId: null,
    delete: vi.fn(),
    getIdToken: vi.fn(),
    getIdTokenResult: vi.fn(),
    reload: vi.fn(),
    toJSON: vi.fn(),
    phoneNumber: null,
    providerId: 'google.com',
    ...overrides,
  } as FirebaseUser;
}

describe('signInWithGoogle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.currentUser = null;
  });

  it('successfully signs in and creates user document', async () => {
    const mockUser = createMockFirebaseUser();
    const mockCredential = {
      user: mockUser,
      providerId: 'google.com',
      operationType: 'signIn' as const,
    };

    vi.mocked(signInWithPopup).mockResolvedValue(mockCredential as any);
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => false,
    } as any);

    const result = await signInWithGoogle();

    expect(signInWithPopup).toHaveBeenCalledOnce();
    expect(setDoc).toHaveBeenCalled(); // User document created
    expect(result.user.uid).toBe('test-uid-123');
  });

  it('updates existing user document on repeat sign-in', async () => {
    const mockUser = createMockFirebaseUser();
    const mockCredential = {
      user: mockUser,
      providerId: 'google.com',
      operationType: 'signIn' as const,
    };

    vi.mocked(signInWithPopup).mockResolvedValue(mockCredential as any);
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({
        uid: 'test-uid-123',
        email: 'test@example.com',
        displayName: 'Old Display Name',
      }),
    } as any);

    await signInWithGoogle();

    expect(setDoc).toHaveBeenCalled();
    // Should update lastLoginAt and profile info
    const setDocCall = vi.mocked(setDoc).mock.calls[0];
    expect(setDocCall[1]).toHaveProperty('lastLoginAt');
    expect(setDocCall[2]).toEqual({ merge: true }); // Merge update for existing user
  });

  it('handles user without display name', async () => {
    const mockUser = createMockFirebaseUser({
      displayName: null,
      email: 'noreply@example.com',
    });
    const mockCredential = {
      user: mockUser,
      providerId: 'google.com',
      operationType: 'signIn' as const,
    };

    vi.mocked(signInWithPopup).mockResolvedValue(mockCredential as any);
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => false,
    } as any);

    await signInWithGoogle();

    expect(setDoc).toHaveBeenCalled();
    const setDocCall = vi.mocked(setDoc).mock.calls[0];
    // Should use email prefix as fallback display name
    expect(setDocCall[1].displayName).toBe('noreply');
  });

  it('handles user without photo URL', async () => {
    const mockUser = createMockFirebaseUser({
      photoURL: null,
    });
    const mockCredential = {
      user: mockUser,
      providerId: 'google.com',
      operationType: 'signIn' as const,
    };

    vi.mocked(signInWithPopup).mockResolvedValue(mockCredential as any);
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => false,
    } as any);

    await signInWithGoogle();

    expect(setDoc).toHaveBeenCalled();
    const setDocCall = vi.mocked(setDoc).mock.calls[0];
    expect(setDocCall[1].photoURL).toBeNull();
  });

  it('throws error when sign-in fails', async () => {
    vi.mocked(signInWithPopup).mockRejectedValue(new Error('Popup closed by user'));

    await expect(signInWithGoogle()).rejects.toThrow('Failed to sign in with Google');
  });

  it('logs error when sign-in fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(signInWithPopup).mockRejectedValue(new Error('Network error'));

    await expect(signInWithGoogle()).rejects.toThrow();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Google sign-in failed:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('sets correct auth provider in user document', async () => {
    const mockUser = createMockFirebaseUser();
    const mockCredential = {
      user: mockUser,
      providerId: 'google.com',
      operationType: 'signIn' as const,
    };

    vi.mocked(signInWithPopup).mockResolvedValue(mockCredential as any);
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => false,
    } as any);

    await signInWithGoogle();

    const setDocCall = vi.mocked(setDoc).mock.calls[0];
    expect(setDocCall[1].authProvider).toBe('google.com');
  });
});

describe('signOut', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully signs out user', async () => {
    vi.mocked(firebaseSignOut).mockResolvedValue();

    await signOut();

    expect(firebaseSignOut).toHaveBeenCalledOnce();
  });

  it('throws error when sign-out fails', async () => {
    vi.mocked(firebaseSignOut).mockRejectedValue(new Error('Network error'));

    await expect(signOut()).rejects.toThrow('Failed to sign out');
  });

  it('logs error when sign-out fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(firebaseSignOut).mockRejectedValue(new Error('Auth error'));

    await expect(signOut()).rejects.toThrow();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Sign-out failed:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });
});

describe('onAuthChange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls callback when auth state changes', () => {
    const callback = vi.fn();
    const unsubscribe = vi.fn();

    vi.mocked(onAuthStateChanged).mockImplementation((auth, cb) => {
      // Simulate immediate callback with null user
      cb(null);
      return unsubscribe;
    });

    const returned = onAuthChange(callback);

    expect(callback).toHaveBeenCalledWith(null);
    expect(returned).toBe(unsubscribe);
  });

  it('calls callback with user when signed in', () => {
    const callback = vi.fn();
    const mockUser = createMockFirebaseUser();

    vi.mocked(onAuthStateChanged).mockImplementation((auth, cb) => {
      cb(mockUser);
      return vi.fn();
    });

    onAuthChange(callback);

    expect(callback).toHaveBeenCalledWith(mockUser);
  });

  it('returns unsubscribe function', () => {
    const callback = vi.fn();
    const unsubscribe = vi.fn();

    vi.mocked(onAuthStateChanged).mockReturnValue(unsubscribe);

    const returned = onAuthChange(callback);

    expect(returned).toBe(unsubscribe);
    expect(typeof returned).toBe('function');
  });
});

describe('getCurrentUser', () => {
  beforeEach(() => {
    mockAuth.currentUser = null;
  });

  it('returns current user when signed in', () => {
    const mockUser = createMockFirebaseUser();
    mockAuth.currentUser = mockUser;

    const user = getCurrentUser();

    expect(user).toBe(mockUser);
    expect(user?.uid).toBe('test-uid-123');
  });

  it('returns null when not signed in', () => {
    mockAuth.currentUser = null;

    const user = getCurrentUser();

    expect(user).toBeNull();
  });

  it('returns updated user after auth state change', () => {
    mockAuth.currentUser = null;
    expect(getCurrentUser()).toBeNull();

    const mockUser = createMockFirebaseUser();
    mockAuth.currentUser = mockUser;
    expect(getCurrentUser()).toBe(mockUser);
  });
});

describe('isAuthenticated', () => {
  beforeEach(() => {
    mockAuth.currentUser = null;
  });

  it('returns true when user is signed in', () => {
    const mockUser = createMockFirebaseUser();
    mockAuth.currentUser = mockUser;

    expect(isAuthenticated()).toBe(true);
  });

  it('returns false when not signed in', () => {
    mockAuth.currentUser = null;

    expect(isAuthenticated()).toBe(false);
  });

  it('updates based on auth state', () => {
    mockAuth.currentUser = null;
    expect(isAuthenticated()).toBe(false);

    mockAuth.currentUser = createMockFirebaseUser();
    expect(isAuthenticated()).toBe(true);

    mockAuth.currentUser = null;
    expect(isAuthenticated()).toBe(false);
  });
});

describe('getCurrentUserId', () => {
  beforeEach(() => {
    mockAuth.currentUser = null;
  });

  it('returns branded UserId when signed in', () => {
    const mockUser = createMockFirebaseUser({ uid: 'user-456' });
    mockAuth.currentUser = mockUser;

    const userId = getCurrentUserId();

    expect(userId).not.toBeNull();
    // TypeScript type check - if this compiles, branded type works
    if (userId) {
      const typedUserId: UserId = userId;
      expect(typedUserId).toBe('user-456');
    }
  });

  it('returns null when not signed in', () => {
    mockAuth.currentUser = null;

    const userId = getCurrentUserId();

    expect(userId).toBeNull();
  });

  it('returns correct ID after auth state change', () => {
    mockAuth.currentUser = null;
    expect(getCurrentUserId()).toBeNull();

    const mockUser1 = createMockFirebaseUser({ uid: 'user-1' });
    mockAuth.currentUser = mockUser1;
    expect(getCurrentUserId()).toBe('user-1');

    const mockUser2 = createMockFirebaseUser({ uid: 'user-2' });
    mockAuth.currentUser = mockUser2;
    expect(getCurrentUserId()).toBe('user-2');
  });
});

describe('waitForAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves with user when signed in', async () => {
    const mockUser = createMockFirebaseUser();

    vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
      // Simulate immediate callback
      setTimeout(() => callback(mockUser), 100);
      return vi.fn();
    });

    const promise = waitForAuth();
    vi.advanceTimersByTime(100);
    const user = await promise;

    expect(user).toBe(mockUser);
  });

  it('resolves with null when not signed in', async () => {
    vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
      setTimeout(() => callback(null), 100);
      return vi.fn();
    });

    const promise = waitForAuth();
    vi.advanceTimersByTime(100);
    const user = await promise;

    expect(user).toBeNull();
  });

  it('rejects on timeout', async () => {
    vi.mocked(onAuthStateChanged).mockImplementation(() => {
      // Never call callback - simulate hanging
      return vi.fn();
    });

    const promise = waitForAuth(1000);
    vi.advanceTimersByTime(1000);

    await expect(promise).rejects.toThrow('Auth initialization timeout');
  });

  it('uses custom timeout value', async () => {
    vi.mocked(onAuthStateChanged).mockImplementation(() => {
      return vi.fn();
    });

    const promise = waitForAuth(2000);
    vi.advanceTimersByTime(2000);

    await expect(promise).rejects.toThrow('Auth initialization timeout');
  });

  it('unsubscribes after resolving', async () => {
    const unsubscribe = vi.fn();
    const mockUser = createMockFirebaseUser();

    vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
      setTimeout(() => callback(mockUser), 100);
      return unsubscribe;
    });

    const promise = waitForAuth();
    vi.advanceTimersByTime(100);
    await promise;

    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('clears timeout after resolving', async () => {
    const mockUser = createMockFirebaseUser();
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
      setTimeout(() => callback(mockUser), 100);
      return vi.fn();
    });

    const promise = waitForAuth();
    vi.advanceTimersByTime(100);
    await promise;

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});

describe('integration scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.currentUser = null;
  });

  it('handles complete sign-in flow', async () => {
    const mockUser = createMockFirebaseUser();
    const mockCredential = {
      user: mockUser,
      providerId: 'google.com',
      operationType: 'signIn' as const,
    };

    vi.mocked(signInWithPopup).mockResolvedValue(mockCredential as any);
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => false,
    } as any);

    // Not authenticated initially
    expect(isAuthenticated()).toBe(false);
    expect(getCurrentUser()).toBeNull();

    // Sign in
    await signInWithGoogle();

    // Update mock auth state
    mockAuth.currentUser = mockUser;

    // Now authenticated
    expect(isAuthenticated()).toBe(true);
    expect(getCurrentUser()).toBe(mockUser);
    expect(getCurrentUserId()).toBe(mockUser.uid);
  });

  it('handles complete sign-out flow', async () => {
    const mockUser = createMockFirebaseUser();
    mockAuth.currentUser = mockUser;

    // Authenticated initially
    expect(isAuthenticated()).toBe(true);

    vi.mocked(firebaseSignOut).mockResolvedValue();

    // Sign out
    await signOut();

    // Update mock auth state
    mockAuth.currentUser = null;

    // No longer authenticated
    expect(isAuthenticated()).toBe(false);
    expect(getCurrentUser()).toBeNull();
    expect(getCurrentUserId()).toBeNull();
  });

  it('handles auth state observation', () => {
    const authStates: Array<FirebaseUser | null> = [];
    const mockUser = createMockFirebaseUser();

    vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
      // Simulate state changes
      setTimeout(() => {
        callback(null);
        setTimeout(() => {
          callback(mockUser);
          setTimeout(() => {
            callback(null);
          }, 100);
        }, 100);
      }, 100);
      return vi.fn();
    });

    onAuthChange((user) => {
      authStates.push(user);
    });

    // In real app, this would capture state changes over time
    expect(onAuthStateChanged).toHaveBeenCalled();
  });
});
