/**
 * User Firestore Operations
 * Identity & Access Domain - Phase 1
 * 
 * CRUD operations for users collection with schema validation
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  type DocumentReference,
} from 'firebase/firestore';
import { db } from '../config';
import { createConverter, convertFromFirestore } from './converters';
import {
  validateUserData,
  validateUpdateUserData,
  type User,
  type UserDocument,
  type UpdateUserData,
  toBranded,
  fromBranded,
  type UserId,
} from '@brayford/core';

/**
 * Firestore converter for User documents
 */
const userConverter = createConverter(validateUserData, ['createdAt', 'lastLoginAt']);

/**
 * Get reference to a user document with type conversion
 * 
 * @param userId - User ID (branded type)
 * @returns Typed document reference
 */
export function getUserRef(userId: UserId): DocumentReference<User> {
  return doc(db, 'users', fromBranded(userId)).withConverter(userConverter);
}

/**
 * Get user by ID
 * 
 * @param userId - User ID (branded type)
 * @returns User document or null if not found
 * 
 * @example
 * ```ts
 * const userId = toBranded<UserId>('abc123');
 * const user = await getUser(userId);
 * if (user) {
 *   console.log(user.displayName);
 * }
 * ```
 */
export async function getUser(userId: UserId): Promise<UserDocument | null> {
  const userRef = getUserRef(userId);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    return null;
  }
  
  return {
    id: userId,
    ...userSnap.data(),
  };
}

/**
 * Update user document
 * Only updates provided fields (partial update)
 * 
 * @param userId - User ID (branded type)
 * @param data - Partial user data to update
 * 
 * @example
 * ```ts
 * await updateUser(userId, {
 *   displayName: 'New Name',
 *   photoURL: 'https://...',
 * });
 * ```
 */
export async function updateUser(
  userId: UserId,
  data: UpdateUserData
): Promise<void> {
  // Validate update data
  const validatedData = validateUpdateUserData(data);
  
  const userRef = doc(db, 'users', fromBranded(userId));
  await updateDoc(userRef, validatedData);
}

/**
 * Delete user document
 * 
 * WARNING: This only deletes the Firestore document.
 * Firebase Auth user must be deleted separately.
 * Consider soft-deletion (isActive: false) instead.
 * 
 * @param userId - User ID (branded type)
 * 
 * @example
 * ```ts
 * // Hard delete (not recommended)
 * await deleteUser(userId);
 * 
 * // Soft delete (recommended)
 * await updateUser(userId, { isActive: false });
 * ```
 */
export async function deleteUser(userId: UserId): Promise<void> {
  const userRef = doc(db, 'users', fromBranded(userId));
  await deleteDoc(userRef);
}

/**
 * Check if user exists
 * 
 * @param userId - User ID (branded type)
 * @returns True if user document exists
 * 
 * @example
 * ```ts
 * if (await userExists(userId)) {
 *   // User found
 * } else {
 *   // User not found
 * }
 * ```
 */
export async function userExists(userId: UserId): Promise<boolean> {
  const userRef = getUserRef(userId);
  const userSnap = await getDoc(userRef);
  return userSnap.exists();
}

/**
 * Batch fetch multiple users by ID
 * 
 * Efficiently fetches multiple user documents in parallel.
 * Returns users in the same order as the input IDs.
 * Returns null for users that don't exist.
 * 
 * @param userIds - Array of user IDs to fetch
 * @returns Array of user documents (null for non-existent users)
 * 
 * @example
 * ```ts
 * const userIds = [userId1, userId2, userId3];
 * const users = await batchGetUsers(userIds);
 * users.forEach((user, index) => {
 *   if (user) {
 *     console.log(`User ${index}: ${user.displayName}`);
 *   } else {
 *     console.log(`User ${index}: Not found`);
 *   }
 * });
 * ```
 */
export async function batchGetUsers(
  userIds: UserId[]
): Promise<(UserDocument | null)[]> {
  // Handle empty array
  if (userIds.length === 0) {
    return [];
  }
  
  // Fetch all users in parallel
  const userPromises = userIds.map((userId) => getUser(userId));
  return Promise.all(userPromises);
}
