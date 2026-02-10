/**
 * User Schema - Identity & Access Domain
 * 
 * Represents individual users who authenticate and use the platform.
 * Users can belong to multiple organizations as members with different roles.
 * 
 * Firestore Collection: /users/{userId}
 */

import { z } from 'zod';
import type { UserId } from '../types/branded';

/**
 * Authentication provider identifier
 * Currently only Google OAuth is supported (Phase 1)
 * Email/password and other providers deferred to post-MVP
 */
export const AuthProviderSchema = z.enum(['google.com']);
export type AuthProvider = z.infer<typeof AuthProviderSchema>;

/**
 * User document schema for Firestore
 * 
 * @property uid - Firebase Auth UID (also serves as Firestore document ID)
 * @property email - User's email from auth provider (unique)
 * @property displayName - User's display name (from Google profile or user-set)
 * @property photoURL - Profile photo URL from Google (null if not provided)
 * @property authProvider - Which auth method was used ('google.com' for MVP)
 * @property createdAt - When the user account was created (server timestamp)
 * @property lastLoginAt - Last successful authentication (updated on each login)
 */
export const UserSchema = z.object({
  uid: z.string().describe('Firebase Auth UID'),
  email: z.string().email().describe('User email address'),
  displayName: z.string().min(1).describe('User display name'),
  photoURL: z.string().url().nullable().describe('Profile photo URL from auth provider'),
  authProvider: AuthProviderSchema.describe('Authentication provider used'),
  createdAt: z.date().describe('Account creation timestamp'),
  lastLoginAt: z.date().describe('Last successful login timestamp'),
  claimsVersion: z.number().int().nonnegative().default(0).describe(
    'Incremented by Cloud Functions when custom claims change. ' +
    'Client watches this field via onSnapshot to trigger token refresh.'
  ),
});

/**
 * Type-safe User object inferred from schema
 */
export type User = z.infer<typeof UserSchema>;

/**
 * User document with typed ID
 * Use this when working with a user document retrieved from Firestore
 */
export interface UserDocument extends User {
  id: UserId;
}

/**
 * Data required to create a new user
 * Omits auto-generated fields (createdAt, lastLoginAt)
 */
export const CreateUserSchema = UserSchema.omit({
  createdAt: true,
  lastLoginAt: true,
});
export type CreateUserData = z.infer<typeof CreateUserSchema>;

/**
 * Data for updating an existing user
 * All fields optional except those that should never change
 */
export const UpdateUserSchema = UserSchema.partial().omit({
  uid: true,
  email: true,
  authProvider: true,
  createdAt: true,
});
export type UpdateUserData = z.infer<typeof UpdateUserSchema>;

/**
 * Validation helper: Validate user data from Firestore
 * 
 * @param data - Raw data from Firestore document
 * @returns Validated User object
 * @throws ZodError if validation fails
 * 
 * @example
 * ```ts
 * const docSnap = await getDoc(doc(db, 'users', userId));
 * const userData = validateUserData({
 *   ...docSnap.data(),
 *   createdAt: docSnap.data().createdAt.toDate(),
 *   lastLoginAt: docSnap.data().lastLoginAt.toDate(),
 * });
 * ```
 */
export function validateUserData(data: unknown): User {
  return UserSchema.parse(data);
}

/**
 * Validation helper: Validate create user data
 * 
 * @param data - User creation data
 * @returns Validated CreateUserData
 * @throws ZodError if validation fails
 */
export function validateCreateUserData(data: unknown): CreateUserData {
  return CreateUserSchema.parse(data);
}

/**
 * Validation helper: Validate update user data
 * 
 * @param data - User update data
 * @returns Validated UpdateUserData
 * @throws ZodError if validation fails
 */
export function validateUpdateUserData(data: unknown): UpdateUserData {
  return UpdateUserSchema.parse(data);
}
