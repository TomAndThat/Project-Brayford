import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUser, updateUser, deleteUser, userExists, getUserRef } from '../users';
import { toBranded, type UserId } from '@brayford/core';
import { createMockUser, createMockUserId } from '@brayford/core/test-helpers';

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => {
  const mockDoc = (_db: any, collection: string, id: string) => {
    const docRef = { collection, id, _isDoc: true, withConverter: vi.fn().mockReturnThis() };
    docRef.withConverter = vi.fn(() => docRef);
    return docRef;
  };
  
  return {
    doc: vi.fn(mockDoc),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
  };
});

// Mock Firebase config
vi.mock('../../config', () => ({
  db: { _isFirestore: true },
  auth: {},
  firebaseApp: {},
}));

import { getDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

describe('getUserRef', () => {
  it('creates a document reference with correct path', () => {
    const userId = createMockUserId('user-123');
    const ref = getUserRef(userId);
    
    expect(doc).toHaveBeenCalledWith(
      expect.objectContaining({ _isFirestore: true }),
      'users',
      'user-123'
    );
  });
});

describe('getUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns user document when it exists', async () => {
    const userId = createMockUserId('user-123');
    const mockUserData = createMockUser({ uid: 'user-123' });

    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => mockUserData,
      id: 'user-123',
    } as any);

    const result = await getUser(userId);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(userId);
    expect(result?.uid).toBe('user-123');
    expect(result?.email).toBe(mockUserData.email);
    expect(result?.displayName).toBe(mockUserData.displayName);
  });

  it('returns null when user does not exist', async () => {
    const userId = createMockUserId('nonexistent-user');

    vi.mocked(getDoc).mockResolvedValue({
      exists: () => false,
    } as any);

    const result = await getUser(userId);

    expect(result).toBeNull();
  });

  it('includes all user properties in returned document', async () => {
    const userId = createMockUserId('user-123');
    const mockUserData = createMockUser({
      uid: 'user-123',
      email: 'test@example.com',
      displayName: 'Test User',
      photoURL: 'https://example.com/photo.jpg',
      authProvider: 'google.com',
      createdAt: new Date('2024-01-01'),
      lastLoginAt: new Date('2024-01-15'),
    });

    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => mockUserData,
      id: 'user-123',
    } as any);

    const result = await getUser(userId);

    expect(result).toEqual({
      id: userId,
      ...mockUserData,
    });
  });

  it('handles user with null photoURL', async () => {
    const userId = createMockUserId('user-123');
    const mockUserData = createMockUser({
      uid: 'user-123',
      photoURL: null,
    });

    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => mockUserData,
      id: 'user-123',
    } as any);

    const result = await getUser(userId);

    expect(result).not.toBeNull();
    expect(result?.photoURL).toBeNull();
  });

  it('uses branded UserId type correctly', async () => {
    const plainId = 'user-456';
    const userId = toBranded<UserId>(plainId);

    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => createMockUser({ uid: plainId }),
      id: plainId,
    } as any);

    const result = await getUser(userId);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(userId);
  });
});

describe('updateUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls updateDoc with validated data', async () => {
    const userId = createMockUserId('user-123');
    const updateData = {
      displayName: 'Updated Name',
      photoURL: 'https://new-photo.example.com/pic.jpg',
    };

    await updateUser(userId, updateData);

    expect(updateDoc).toHaveBeenCalledOnce();
    expect(updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-123' }),
      updateData
    );
  });

  it('allows partial updates with single field', async () => {
    const userId = createMockUserId('user-123');
    const updateData = {
      displayName: 'New Display Name',
    };

    await updateUser(userId, updateData);

    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      updateData
    );
  });

  it('allows updating photoURL to null', async () => {
    const userId = createMockUserId('user-123');
    const updateData = {
      photoURL: null,
    };

    await updateUser(userId, updateData);

    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { photoURL: null }
    );
  });

  it('allows updating lastLoginAt', async () => {
    const userId = createMockUserId('user-123');
    const newLoginTime = new Date('2024-02-01T10:00:00Z');
    const updateData = {
      lastLoginAt: newLoginTime,
    };

    await updateUser(userId, updateData);

    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { lastLoginAt: newLoginTime }
    );
  });

  it('validates update data before calling Firestore', async () => {
    const userId = createMockUserId('user-123');
    
    // Invalid update (empty displayName)
    const invalidUpdate = {
      displayName: '',
    };

    await expect(updateUser(userId, invalidUpdate)).rejects.toThrow();
    
    // updateDoc should not be called with invalid data
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('rejects updates to immutable fields', async () => {
    const userId = createMockUserId('user-123');
    
    // These fields should be filtered out by validation
    const updateData = {
      displayName: 'Valid Name',
      uid: 'should-not-update' as any,
      email: 'should-not-update@example.com' as any,
      createdAt: new Date() as any,
    };

    await updateUser(userId, updateData);

    // Only displayName should be in the update
    const actualCall = vi.mocked(updateDoc).mock.calls[0][1];
    expect(actualCall).toHaveProperty('displayName');
    expect(actualCall).not.toHaveProperty('uid');
    expect(actualCall).not.toHaveProperty('email');
    expect(actualCall).not.toHaveProperty('createdAt');
  });

  it('handles multiple field updates', async () => {
    const userId = createMockUserId('user-123');
    const updateData = {
      displayName: 'New Name',
      photoURL: 'https://new-photo.com/pic.jpg',
      lastLoginAt: new Date(),
    };

    await updateUser(userId, updateData);

    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      updateData
    );
  });
});

describe('deleteUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls deleteDoc with correct user reference', async () => {
    const userId = createMockUserId('user-123');

    await deleteUser(userId);

    expect(deleteDoc).toHaveBeenCalledOnce();
    expect(deleteDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-123' })
    );
  });

  it('handles deletion of different user IDs', async () => {
    const userId1 = createMockUserId('user-1');
    const userId2 = createMockUserId('user-2');

    await deleteUser(userId1);
    await deleteUser(userId2);

    expect(deleteDoc).toHaveBeenCalledTimes(2);
  });

  it('works with branded UserId type', async () => {
    const userId = toBranded<UserId>('user-to-delete');

    await deleteUser(userId);

    expect(deleteDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-to-delete' })
    );
  });
});

describe('userExists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when user exists', async () => {
    const userId = createMockUserId('existing-user');

    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
    } as any);

    const result = await userExists(userId);

    expect(result).toBe(true);
    expect(getDoc).toHaveBeenCalledOnce();
  });

  it('returns false when user does not exist', async () => {
    const userId = createMockUserId('nonexistent-user');

    vi.mocked(getDoc).mockResolvedValue({
      exists: () => false,
    } as any);

    const result = await userExists(userId);

    expect(result).toBe(false);
    expect(getDoc).toHaveBeenCalledOnce();
  });

  it('checks existence for different user IDs', async () => {
    const userId1 = createMockUserId('user-1');
    const userId2 = createMockUserId('user-2');

    vi.mocked(getDoc)
      .mockResolvedValueOnce({
        exists: () => true,
      } as any)
      .mockResolvedValueOnce({
        exists: () => false,
      } as any);

    expect(await userExists(userId1)).toBe(true);
    expect(await userExists(userId2)).toBe(false);
  });

  it('uses correct document reference', async () => {
    const userId = createMockUserId('user-123');

    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
    } as any);

    await userExists(userId);

    // Verify getDoc was called with a reference pointing to the right user
    expect(getDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-123' })
    );
  });
});

describe('integration scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles user lifecycle: check existence, update, delete', async () => {
    const userId = createMockUserId('lifecycle-user');

    // Check if user exists
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => createMockUser({ uid: 'lifecycle-user' }),
    } as any);

    const exists = await userExists(userId);
    expect(exists).toBe(true);

    // Update user
    await updateUser(userId, { displayName: 'Updated Name' });
    expect(updateDoc).toHaveBeenCalled();

    // Delete user
    await deleteUser(userId);
    expect(deleteDoc).toHaveBeenCalled();
  });

  it('handles retrieving and updating user in sequence', async () => {
    const userId = createMockUserId('user-123');
    const originalUser = createMockUser({
      uid: 'user-123',
      displayName: 'Original Name',
    });

    // Get user
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => originalUser,
    } as any);

    const user = await getUser(userId);
    expect(user?.displayName).toBe('Original Name');

    // Update user
    await updateUser(userId, { displayName: 'New Name' });
    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { displayName: 'New Name' }
    );
  });

  it('handles non-existent user gracefully', async () => {
    const userId = createMockUserId('nonexistent');

    vi.mocked(getDoc).mockResolvedValue({
      exists: () => false,
    } as any);

    const exists = await userExists(userId);
    expect(exists).toBe(false);

    const user = await getUser(userId);
    expect(user).toBeNull();
  });
});
