/**
 * Invitation Email Helper
 * 
 * High-level function for sending invitation emails.
 * Wraps the generic sendEmail with invitation-specific types and validation.
 */

import { sendEmail } from '../client';
import { withRateLimit } from '../rate-limiter';
import { normalizeEmail } from '../utils/validation';
import type { EmailResult, EmailMetadata } from '../types';
import type { OrganizationId, UserId } from '@brayford/core';

/**
 * Data required to send an invitation email (UK English user-facing copy)
 */
export interface InvitationEmailData {
  /** Recipient email address */
  recipientEmail: string;
  /** Display name of the person sending the invitation */
  inviterName: string;
  /** Organisation name (UK English in UI) */
  organizationName: string;
  /** Role being offered: 'Admin' or 'Member' (display string) */
  role: string;
  /** Full invitation URL including token */
  invitationUrl: string;
  /** When the invitation expires */
  expiresAt: Date;
  /** Organization ID for rate limiting and metadata */
  organizationId: OrganizationId;
  /** Inviter's user ID for metadata */
  invitedByUserId: UserId;
}

/**
 * Send an invitation email
 * 
 * Uses the `organization-invitation` Postmark template.
 * Rate-limited to 10 invitations per minute per organization.
 * In dev mode, logs to console instead of sending.
 * 
 * @param data - Invitation email data
 * @returns Email result with message ID and send status
 * 
 * @example
 * ```ts
 * await sendInvitationEmail({
 *   recipientEmail: 'newuser@example.com',
 *   inviterName: 'Alice Smith',
 *   organizationName: 'BBC',
 *   role: 'Member',
 *   invitationUrl: 'https://app.brayford.com/join?token=abc123',
 *   expiresAt: new Date('2026-02-16'),
 *   organizationId: orgId,
 *   invitedByUserId: userId,
 * });
 * ```
 */
export async function sendInvitationEmail(
  data: InvitationEmailData
): Promise<EmailResult> {
  const to = normalizeEmail(data.recipientEmail);

  // Format expiry date in UK English format
  const formattedExpiry = data.expiresAt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const metadata: EmailMetadata = {
    organizationId: data.organizationId,
    userId: data.invitedByUserId,
  };

  // Apply rate limiting (10 invitations per minute per organization)
  return withRateLimit(
    {
      type: 'invitation',
      scopeId: data.organizationId as string,
    },
    () =>
      sendEmail({
        type: 'invitation',
        to,
        templateAlias: 'organization-invitation',
        templateData: {
          organizationName: data.organizationName,
          inviterName: data.inviterName,
          inviteLink: data.invitationUrl,
          role: data.role,
          expiresAt: formattedExpiry,
        },
        metadata,
      })
  );
}
