/**
 * Deletion Email Helpers
 * 
 * High-level functions for sending organisation deletion emails.
 * Three email types for the deletion flow:
 * 1. Confirmation - sent to requester, must click within 24h
 * 2. Alert - sent to all users with org:delete permission when deletion confirmed
 * 3. Complete - sent when permanent deletion occurs after 28 days
 */

import { sendEmail } from '../client';
import { withRateLimit } from '../rate-limiter';
import { normalizeEmail } from '../utils/validation';
import type { EmailResult, EmailMetadata } from '../types';
import type { OrganizationId, UserId } from '@brayford/core';

// ===== Confirmation Email (Step 2: User must click link) =====

/**
 * Data required to send a deletion confirmation email
 */
export interface DeletionConfirmEmailData {
  /** Recipient email address (the user who initiated deletion) */
  recipientEmail: string;
  /** Organisation name (UK English in user-facing copy) */
  organizationName: string;
  /** Display name of the person who requested deletion */
  requestedBy: string;
  /** Full confirmation URL including token */
  confirmationUrl: string;
  /** When the confirmation link expires */
  expiresAt: Date;
  /** Organization ID for rate limiting and metadata */
  organizationId: OrganizationId;
  /** Requester's user ID for metadata */
  requestedByUserId: UserId;
}

/**
 * Send a deletion confirmation email
 * 
 * Sent to the user who initiated the deletion request.
 * They must click the link within 24 hours to confirm.
 * Rate-limited to 1 per organization per minute (prevents spam).
 * 
 * @param data - Deletion confirmation email data
 * @returns Email result with message ID and send status
 */
export async function sendDeletionConfirmEmail(
  data: DeletionConfirmEmailData
): Promise<EmailResult> {
  const to = normalizeEmail(data.recipientEmail);

  const formattedExpiry = data.expiresAt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const metadata: EmailMetadata = {
    organizationId: data.organizationId,
    userId: data.requestedByUserId,
  };

  return withRateLimit(
    () =>
      sendEmail({
        type: 'organization-deletion',
        to,
        templateAlias: 'organization-deletion-confirm',
        templateData: {
          organizationName: data.organizationName,
          requestedBy: data.requestedBy,
          confirmationLink: data.confirmationUrl,
          expiresAt: formattedExpiry,
        },
        metadata,
      }),
    {
      type: 'organization-deletion',
      scopeId: data.organizationId as string,
    }
  );
}

// ===== Alert Email (Step 4: Notify users with org:delete permission) =====

/**
 * Data required to send a deletion alert email
 */
export interface DeletionAlertEmailData {
  /** Recipient email address (user with org:delete permission) */
  recipientEmail: string;
  /** Organisation name */
  organizationName: string;
  /** Display name of the person who confirmed deletion */
  confirmedBy: string;
  /** When the organisation will be permanently deleted */
  scheduledDate: Date;
  /** Full undo URL including token */
  undoUrl: string;
  /** When the undo link expires */
  undoExpiresAt: Date;
  /** Organization ID for metadata */
  organizationId: OrganizationId;
}

/**
 * Send a deletion alert email
 * 
 * Sent to all users with org:delete permission when deletion is confirmed.
 * Includes an undo link valid for 24 hours.
 * 
 * @param data - Deletion alert email data
 * @returns Email result with message ID and send status
 */
export async function sendDeletionAlertEmail(
  data: DeletionAlertEmailData
): Promise<EmailResult> {
  const to = normalizeEmail(data.recipientEmail);

  const formattedUndoExpiry = data.undoExpiresAt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const metadata: EmailMetadata = {
    organizationId: data.organizationId,
  };

  // No rate limit for alerts - these are critical notifications
  return sendEmail({
    type: 'organization-deletion',
    to,
    templateAlias: 'organization-deletion-alert',
    templateData: {
      organizationName: data.organizationName,
      confirmedBy: data.confirmedBy,
      undoLink: data.undoUrl,
      undoExpiresAt: formattedUndoExpiry,
    },
    metadata,
  });
}

// ===== Completion Email (Step 6: Permanent deletion done) =====

/**
 * Data required to send a deletion complete email
 */
export interface DeletionCompleteEmailData {
  /** Recipient email address */
  recipientEmail: string;
  /** Organisation name */
  organizationName: string;
  /** When the deletion was completed */
  deletionDate: Date;
  /** Organization ID for metadata */
  organizationId: OrganizationId;
}

/**
 * Send a deletion complete email
 * 
 * Sent to all former members when permanent deletion is executed.
 * This is a final notification - no further action possible.
 * 
 * @param data - Deletion complete email data
 * @returns Email result with message ID and send status
 */
export async function sendDeletionCompleteEmail(
  data: DeletionCompleteEmailData
): Promise<EmailResult> {
  const to = normalizeEmail(data.recipientEmail);

  const formattedDate = data.deletionDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const metadata: EmailMetadata = {
    organizationId: data.organizationId,
  };

  // No rate limit for completion - system-generated, one-time emails
  return sendEmail({
    type: 'organization-deletion',
    to,
    templateAlias: 'organization-deletion-complete',
    templateData: {
      organizationName: data.organizationName,
      deletionDate: formattedDate,
    },
    metadata,
  });
}
