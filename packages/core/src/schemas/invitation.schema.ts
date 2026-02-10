/**
 * Invitation Schema - Organization Domain
 * 
 * Invitations allow organization owners/admins to invite users by email.
 * An invitation exists independently of the user — the target user may not
 * have an account yet. Once accepted, an organizationMember record is created.
 * 
 * Lifecycle: pending → accepted | declined | expired
 * 
 * Firestore Collection: /invitations/{invitationId}
 */

import { z } from 'zod';
import type {
  InvitationId,
  OrganizationId,
  UserId,
  BrandId,
} from '../types/branded';

// ===== Invitation Status =====

/**
 * Invitation lifecycle states
 * 
 * - pending: Invitation sent, awaiting user action
 * - accepted: User accepted and joined the organization
 * - declined: User explicitly declined
 * - expired: Invitation passed its expiresAt date without action
 */
export const InvitationStatusSchema = z.enum([
  'pending',
  'accepted',
  'declined',
  'expired',
]);
export type InvitationStatus = z.infer<typeof InvitationStatusSchema>;

// ===== Invitation Role =====

/**
 * Roles assignable via invitation
 * 
 * - owner: Can be invited by existing owners (requires confirmation due to elevated permissions)
 * - admin: Can manage team members and all brands
 * - member: Can access assigned brands only
 */
export const InvitationRoleSchema = z.enum(['owner', 'admin', 'member']);
export type InvitationRole = z.infer<typeof InvitationRoleSchema>;

// ===== Invitation Schema =====

/**
 * Full invitation document schema
 * 
 * @property email - Target user's email (normalized lowercase)
 * @property organizationId - Organization extending the invitation
 * @property organizationName - Denormalized for email templates and UI display
 * @property role - Role the user will receive on acceptance
 * @property brandAccess - Brand IDs the user will have access to (empty for admins)
 * @property autoGrantNewBrands - Whether to auto-grant access to future brands
 * @property invitedBy - UserId of the inviter
 * @property invitedAt - When the invitation was created
 * @property status - Current lifecycle state
 * @property token - Secure UUID for email link verification
 * @property expiresAt - When the invitation expires (7 days from creation by default)
 * @property acceptedAt - When the user accepted (null until accepted)
 * @property metadata - Optional denormalized inviter info for UX
 */
export const InvitationSchema = z.object({
  email: z
    .string()
    .email()
    .transform((e) => e.toLowerCase().trim())
    .describe('Target user email (normalized lowercase)'),
  organizationId: z.string().describe('Organization extending invitation'),
  organizationName: z.string().min(1).describe('Denormalized org name for emails/UI'),
  role: InvitationRoleSchema.describe('Role assigned on acceptance'),
  brandAccess: z.array(z.string()).describe('BrandIds user will access (empty for admin)'),
  autoGrantNewBrands: z.boolean().describe('Auto-grant access to future brands'),
  invitedBy: z.string().describe('UserId of the inviter'),
  invitedAt: z.date().describe('When the invitation was created'),
  status: InvitationStatusSchema.describe('Current invitation status'),
  token: z.string().min(1).describe('Secure token for email link'),
  expiresAt: z.date().describe('When the invitation expires'),
  acceptedAt: z.date().nullable().optional().describe('When the user accepted'),
  metadata: z
    .object({
      inviterName: z.string().optional(),
      inviterEmail: z.string().optional(),
    })
    .optional()
    .describe('Denormalized inviter info for UX'),
});

export type Invitation = z.infer<typeof InvitationSchema>;

/**
 * Invitation document with typed ID
 */
export interface InvitationDocument extends Invitation {
  id: InvitationId;
  organizationId: OrganizationId;
  invitedBy: UserId;
  brandAccess: BrandId[];
}

// ===== Create Invitation Schema =====

/**
 * Data required to create a new invitation
 * Omits server-generated fields (invitedAt, status, acceptedAt)
 */
export const CreateInvitationSchema = InvitationSchema.omit({
  invitedAt: true,
  status: true,
  acceptedAt: true,
});
export type CreateInvitationData = z.infer<typeof CreateInvitationSchema>;

// ===== Update Invitation Schema =====

/**
 * Data for updating an invitation (status changes, resending)
 */
export const UpdateInvitationSchema = z.object({
  status: InvitationStatusSchema.optional(),
  acceptedAt: z.date().nullable().optional(),
  expiresAt: z.date().optional(),
});
export type UpdateInvitationData = z.infer<typeof UpdateInvitationSchema>;

// ===== Validation Helpers =====

export function validateInvitationData(data: unknown): Invitation {
  return InvitationSchema.parse(data);
}

export function validateCreateInvitationData(data: unknown): CreateInvitationData {
  return CreateInvitationSchema.parse(data);
}

export function validateUpdateInvitationData(data: unknown): UpdateInvitationData {
  return UpdateInvitationSchema.parse(data);
}

// ===== Token Helpers =====

/**
 * Generate a secure token for invitation links
 * Uses crypto.randomUUID() for cryptographic randomness
 */
export function generateInvitationToken(): string {
  return crypto.randomUUID();
}

/**
 * Default invitation expiry in days
 */
export const INVITATION_EXPIRY_DAYS = 7;

/**
 * Calculate expiry date from now
 */
export function calculateInvitationExpiry(days: number = INVITATION_EXPIRY_DAYS): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry;
}

/**
 * Check if an invitation has expired
 */
export function isInvitationExpired(invitation: Pick<Invitation, 'expiresAt'>): boolean {
  return new Date() > invitation.expiresAt;
}

/**
 * Check if an invitation is actionable (pending and not expired)
 */
export function isInvitationActionable(
  invitation: Pick<Invitation, 'status' | 'expiresAt'>
): boolean {
  return invitation.status === 'pending' && !isInvitationExpired(invitation);
}
