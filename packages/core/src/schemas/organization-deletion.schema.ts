/**
 * Organization Deletion Schema - Organization Domain
 * 
 * Manages the multi-step organization deletion process with safeguards:
 * 1. User initiates deletion in settings (type org name to confirm)
 * 2. Confirmation email sent with 24-hour link
 * 3. Email link click confirms deletion → org soft-deleted
 * 4. Alert emails sent to all users with org:delete permission
 * 5. 28-day grace period before permanent deletion
 * 6. Firebase function deletes org and related data after grace period
 * 
 * Firestore Collections:
 * - /organizationDeletionRequests/{requestId}
 * - /deletedOrganizationsAudit/{auditId} (permanent record)
 */

import { z } from 'zod';
import type { OrganizationId, UserId } from '../types/branded';

/**
 * Deletion request lifecycle states
 * 
 * - pending-email: Waiting for user to click confirmation email link
 * - confirmed-deletion: User confirmed via email, org soft-deleted, undo available for 24h
 * - cancelled: Deletion undone within 24h window
 * - completed: Permanent deletion executed after 28 days
 */
export const DeletionRequestStatusSchema = z.enum([
  'pending-email',
  'confirmed-deletion',
  'cancelled',
  'completed',
]);
export type DeletionRequestStatus = z.infer<typeof DeletionRequestStatusSchema>;

/**
 * How the deletion was acted upon
 */
export const DeletionActionTypeSchema = z.enum(['email-link', 'manual-undo', 'system-cleanup']);
export type DeletionActionType = z.infer<typeof DeletionActionTypeSchema>;

/**
 * Audit log entry for deletion request
 */
export const DeletionAuditEntrySchema = z.object({
  timestamp: z.date().describe('When the action occurred'),
  action: z.string().describe('Description of the action'),
  userId: z.string().nullable().describe('UserId who performed the action (null for system)'),
  metadata: z.record(z.unknown()).optional().describe('Additional action metadata'),
});
export type DeletionAuditEntry = z.infer<typeof DeletionAuditEntrySchema>;

/**
 * Organization deletion request document
 * 
 * @property organizationId - Organization being deleted
 * @property organizationName - Denormalized for emails and audit
 * @property requestedBy - UserId who initiated deletion
 * @property requestedAt - When deletion was initiated
 * @property confirmationToken - Secure token for email confirmation link
 * @property tokenExpiresAt - When confirmation token expires (24h from requestedAt)
 * @property confirmationEmailSentAt - When confirmation email was sent
 * @property confirmedAt - When user clicked email confirmation link (null until confirmed)
 * @property confirmedVia - How deletion was confirmed (null until confirmed)
 * @property status - Current request status
 * @property scheduledDeletionAt - When permanent deletion will occur (+28 days from confirmedAt)
 * @property undoToken - Secure token for undo links (generated on confirmation)
 * @property undoExpiresAt - When undo option expires (24h from confirmedAt)
 * @property auditLog - Chronological log of all actions on this request
 */
export const OrganizationDeletionRequestSchema = z.object({
  organizationId: z.string().describe('Organization being deleted'),
  organizationName: z.string().min(1).describe('Denormalized org name'),
  requestedBy: z.string().describe('UserId who initiated deletion'),
  requestedAt: z.date().describe('When deletion was initiated'),
  confirmationToken: z.string().min(1).describe('Secure token for email link'),
  tokenExpiresAt: z.date().describe('When confirmation token expires'),
  confirmationEmailSentAt: z.date().describe('When confirmation email was sent'),
  confirmedAt: z.date().nullable().describe('When confirmed via email link'),
  confirmedVia: DeletionActionTypeSchema.nullable().optional().describe('How deletion was confirmed'),
  status: DeletionRequestStatusSchema.describe('Current request status'),
  scheduledDeletionAt: z.date().nullable().describe('When permanent deletion occurs'),
  undoToken: z.string().nullable().optional().describe('Secure token for undo links'),
  undoExpiresAt: z.date().nullable().optional().describe('When undo option expires'),
  auditLog: z.array(DeletionAuditEntrySchema).describe('Audit trail'),
});

export type OrganizationDeletionRequest = z.infer<typeof OrganizationDeletionRequestSchema>;

/**
 * Deletion request document with typed ID
 */
export interface OrganizationDeletionRequestDocument extends OrganizationDeletionRequest {
  id: string;
  organizationId: OrganizationId;
  requestedBy: UserId;
}

/**
 * Data required to create a new deletion request
 */
export const CreateDeletionRequestSchema = OrganizationDeletionRequestSchema.omit({
  requestedAt: true,
  confirmationEmailSentAt: true,
  confirmedAt: true,
  status: true,
  scheduledDeletionAt: true,
  undoToken: true,
  undoExpiresAt: true,
  auditLog: true,
  confirmedVia: true,
});
export type CreateDeletionRequestData = z.infer<typeof CreateDeletionRequestSchema>;

/**
 * Data for updating deletion request status
 */
export const UpdateDeletionRequestSchema = z.object({
  status: DeletionRequestStatusSchema.optional(),
  confirmedAt: z.date().nullable().optional(),
  confirmedVia: DeletionActionTypeSchema.nullable().optional(),
  scheduledDeletionAt: z.date().nullable().optional(),
  undoToken: z.string().nullable().optional(),
  undoExpiresAt: z.date().nullable().optional(),
  auditLog: z.array(DeletionAuditEntrySchema).optional(),
});
export type UpdateDeletionRequestData = z.infer<typeof UpdateDeletionRequestSchema>;

/**
 * Permanent audit record (survives org deletion)
 * Stored in separate collection for compliance/legal requirements
 */
export const DeletedOrganizationAuditSchema = z.object({
  organizationId: z.string().describe('Deleted organization ID'),
  organizationName: z.string().describe('Deleted organization name'),
  deletionRequestId: z.string().describe('Reference to deletion request'),
  requestedBy: z.string().describe('UserId who initiated deletion'),
  requestedAt: z.date().describe('When deletion was initiated'),
  confirmedAt: z.date().describe('When deletion was confirmed'),
  completedAt: z.date().describe('When permanent deletion occurred'),
  memberCount: z.number().int().describe('Number of members at deletion'),
  brandCount: z.number().int().describe('Number of brands at deletion'),
  auditLog: z.array(DeletionAuditEntrySchema).describe('Full audit trail'),
});

export type DeletedOrganizationAudit = z.infer<typeof DeletedOrganizationAuditSchema>;

/**
 * Audit document with typed ID
 */
export interface DeletedOrganizationAuditDocument extends DeletedOrganizationAudit {
  id: string;
  organizationId: OrganizationId;
  requestedBy: UserId;
}

// ===== Validation Helpers =====

export function validateDeletionRequestData(data: unknown): OrganizationDeletionRequest {
  return OrganizationDeletionRequestSchema.parse(data);
}

export function validateCreateDeletionRequestData(data: unknown): CreateDeletionRequestData {
  return CreateDeletionRequestSchema.parse(data);
}

export function validateUpdateDeletionRequestData(data: unknown): UpdateDeletionRequestData {
  return UpdateDeletionRequestSchema.parse(data);
}

export function validateDeletedOrganizationAuditData(data: unknown): DeletedOrganizationAudit {
  return DeletedOrganizationAuditSchema.parse(data);
}

// ===== Token Helpers =====

/**
 * Generate secure token for confirmation/undo links
 * Uses crypto.randomUUID() for cryptographic randomness
 */
export function generateDeletionToken(): string {
  return crypto.randomUUID();
}

/**
 * Check if confirmation token has expired
 */
export function isConfirmationTokenExpired(request: { tokenExpiresAt: Date }): boolean {
  return new Date() > request.tokenExpiresAt;
}

/**
 * Check if undo window has expired
 */
export function isUndoExpired(request: { undoExpiresAt: Date | null }): boolean {
  if (!request.undoExpiresAt) return true;
  return new Date() > request.undoExpiresAt;
}

/**
 * Check if organization is scheduled for deletion
 */
export function isScheduledForDeletion(request: OrganizationDeletionRequest): boolean {
  return request.status === 'confirmed-deletion' && request.scheduledDeletionAt !== null;
}

/**
 * Calculate token expiry (24 hours from now)
 */
export function calculateTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 24);
  return expiry;
}

/**
 * Calculate scheduled deletion date (28 days from now)
 */
export function calculateScheduledDeletion(): Date {
  const scheduled = new Date();
  scheduled.setDate(scheduled.getDate() + 28);
  return scheduled;
}

/**
 * Add audit log entry to deletion request
 */
export function addAuditEntry(
  request: OrganizationDeletionRequest,
  action: string,
  userId: string | null,
  metadata?: Record<string, unknown>
): DeletionAuditEntry[] {
  const entry: DeletionAuditEntry = {
    timestamp: new Date(),
    action,
    userId,
    metadata,
  };
  return [...request.auditLog, entry];
}
