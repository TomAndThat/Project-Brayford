/**
 * Organization Schema - Organization Domain
 * 
 * Organizations represent the paying customer/account (e.g., "BBC", "MrBeast LLC", "Jane Smith Productions").
 * Organizations can have multiple team members (users) with different roles and permissions.
 * Organizations can own multiple brands.
 * 
 * Firestore Collections:
 * - /organizations/{organizationId}
 * - /organizationMembers/{memberId}
 */

import { z } from 'zod';
import type { OrganizationId, OrganizationMemberId, UserId, BrandId } from '../types/branded';

/**
 * Organization type determines feature access and billing structure
 * 
 * - individual: Solo creator (1 user, typically 1 brand)
 * - team: Small team (2-10 users, multiple brands)
 * - enterprise: Large organization (10+ users, many brands, custom features)
 */
export const OrganizationTypeSchema = z.enum(['individual', 'team', 'enterprise']);
export type OrganizationType = z.infer<typeof OrganizationTypeSchema>;

/**
 * Organization document schema
 * 
 * @property name - Organization name (e.g., "BBC", "MrBeast LLC")
 * @property type - Organization tier/type
 * @property billingEmail - Primary email for billing and invoices
 * @property createdAt - When the organization was created
 * @property createdBy - UserId of the user who created the org (becomes owner)
 * @property settings - Flexible object for org-wide preferences
 */
export const OrganizationSchema = z.object({
  name: z.string().min(1).max(100).describe('Organization name'),
  type: OrganizationTypeSchema.describe('Organization type/tier'),
  billingEmail: z.string().email().describe('Billing and invoice email'),
  createdAt: z.date().describe('Organization creation timestamp'),
  createdBy: z.string().describe('UserId of creator (becomes owner)'),
  settings: z.record(z.unknown()).optional().describe('Organization-wide settings'),
});

export type Organization = z.infer<typeof OrganizationSchema>;

/**
 * Organization document with typed ID
 */
export interface OrganizationDocument extends Organization {
  id: OrganizationId;
}

/**
 * Data required to create a new organization
 */
export const CreateOrganizationSchema = OrganizationSchema.omit({
  createdAt: true,
});
export type CreateOrganizationData = z.infer<typeof CreateOrganizationSchema>;

/**
 * Data for updating an organization
 */
export const UpdateOrganizationSchema = OrganizationSchema.partial().omit({
  createdAt: true,
  createdBy: true,
});
export type UpdateOrganizationData = z.infer<typeof UpdateOrganizationSchema>;

// ===== Organization Member Schema =====

/**
 * Role within an organization
 * 
 * - owner: Full control (billing, delete org, manage all members)
 * - admin: Can manage team members and all brands
 * - member: Can access assigned brands only
 */
export const OrganizationRoleSchema = z.enum(['owner', 'admin', 'member']);
export type OrganizationRole = z.infer<typeof OrganizationRoleSchema>;

/**
 * Organization member document schema (junction table between users and organizations)
 * 
 * Supports two onboarding flows:
 * Flow A: New user creates new org → invitedAt = null, joinedAt = createdAt
 * Flow B: New user joins existing org → invitedAt set, joinedAt set on acceptance
 * 
 * Permission system:
 * - By default, permissions are derived from the role (owner/admin/member)
 * - Optional custom permissions array for future flexibility
 * - See packages/core/src/permissions/ for permission helpers
 * 
 * @property organizationId - Reference to organization
 * @property userId - Reference to user
 * @property role - User's role within this organization
 * @property permissions - Optional custom permissions array (if null/undefined, derive from role)
 * @property brandAccess - Array of BrandIds this user can access (empty = all brands for owner/admin)
 * @property invitedAt - When invitation was sent (null if Flow A)
 * @property joinedAt - When user accepted/joined (immediately for Flow A)
 * @property invitedBy - UserId who sent the invitation (null if Flow A)
 */
export const OrganizationMemberSchema = z.object({
  organizationId: z.string().describe('Reference to organization'),
  userId: z.string().describe('Reference to user'),
  role: OrganizationRoleSchema.describe('Role within organization'),
  permissions: z.array(z.string()).optional().describe('Custom permissions (if null, derive from role)'),
  brandAccess: z.array(z.string()).describe('BrandIds accessible to this member (empty = all)'),
  invitedAt: z.date().nullable().describe('When invitation was sent (null if self-created org)'),
  joinedAt: z.date().describe('When user joined the organization'),
  invitedBy: z.string().nullable().describe('UserId who invited this member (null if self-created)'),
});

export type OrganizationMember = z.infer<typeof OrganizationMemberSchema>;

/**
 * Organization member document with typed ID
 */
export interface OrganizationMemberDocument extends OrganizationMember {
  id: OrganizationMemberId;
  organizationId: OrganizationId;
  userId: UserId;
  brandAccess: BrandId[];
  invitedBy: UserId | null;
}

/**
 * Data required to create a new organization member (Flow A: self-creation)
 * User creates org and becomes owner automatically
 */
export const CreateOrganizationMemberSelfSchema = OrganizationMemberSchema.omit({
  invitedAt: true,
  invitedBy: true,
  joinedAt: true,
}).extend({
  role: z.literal('owner'), // Must be owner when self-creating
});
export type CreateOrganizationMemberSelfData = z.infer<typeof CreateOrganizationMemberSelfSchema>;

/**
 * Data required to invite a user to existing organization (Flow B: invitation)
 */
export const InviteOrganizationMemberSchema = OrganizationMemberSchema.omit({
  invitedAt: true,
  joinedAt: true,
});
export type InviteOrganizationMemberData = z.infer<typeof InviteOrganizationMemberSchema>;

/**
 * Data for updating an organization member
 */
export const UpdateOrganizationMemberSchema = z.object({
  role: OrganizationRoleSchema.optional(),
  brandAccess: z.array(z.string()).optional(),
});
export type UpdateOrganizationMemberData = z.infer<typeof UpdateOrganizationMemberSchema>;

// ===== Validation Helpers =====

export function validateOrganizationData(data: unknown): Organization {
  return OrganizationSchema.parse(data);
}

export function validateCreateOrganizationData(data: unknown): CreateOrganizationData {
  return CreateOrganizationSchema.parse(data);
}

export function validateUpdateOrganizationData(data: unknown): UpdateOrganizationData {
  return UpdateOrganizationSchema.parse(data);
}

export function validateOrganizationMemberData(data: unknown): OrganizationMember {
  return OrganizationMemberSchema.parse(data);
}

export function validateCreateOrganizationMemberSelfData(
  data: unknown
): CreateOrganizationMemberSelfData {
  return CreateOrganizationMemberSelfSchema.parse(data);
}

export function validateInviteOrganizationMemberData(
  data: unknown
): InviteOrganizationMemberData {
  return InviteOrganizationMemberSchema.parse(data);
}

export function validateUpdateOrganizationMemberData(
  data: unknown
): UpdateOrganizationMemberData {
  return UpdateOrganizationMemberSchema.parse(data);
}
