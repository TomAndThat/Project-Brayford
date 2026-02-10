/**
 * Email Queue Schema - Email Domain
 *
 * Provides type-safe schemas for the email queue system, which processes
 * emails via Cloud Functions rather than direct API calls.
 *
 * Two delivery modes:
 * - immediate: Transactional emails (invitations, password resets) - processed on create
 * - batch: Bulk emails (marketing, digests) - processed on schedule
 *
 * Firestore Collection:
 * - /emailQueue/{emailId}
 */

import { z } from 'zod';
import type { OrganizationId, UserId, EventId, BrandId } from '../types/branded';

// ===== Branded Type =====

/**
 * Branded type for email queue IDs
 */
export type EmailQueueId = string & { readonly __brand: 'EmailQueueId' };

// ===== Enums =====

/**
 * Email type - determines rate limiting and categorisation
 */
export const EmailTypeSchema = z.enum([
  'invitation', // Organisation member invitations
  'password-reset', // Password reset requests
  'verification', // Email verification
  'event-reminder', // Event reminders (bulk)
  'weekly-digest', // Weekly summaries (bulk)
  'marketing', // Marketing campaigns (bulk)
  'billing-invoice', // Payment receipts
  'organization-deletion', // Organisation deletion flow
]);
export type EmailType = z.infer<typeof EmailTypeSchema>;

/**
 * Delivery mode - determines processing strategy
 */
export const DeliveryModeSchema = z.enum([
  'immediate', // Transactional: processed by onCreate trigger
  'batch', // Bulk: processed by scheduled function
]);
export type DeliveryMode = z.infer<typeof DeliveryModeSchema>;

/**
 * Email queue status
 */
export const EmailQueueStatusSchema = z.enum([
  'pending', // Awaiting processing
  'processing', // Currently being processed
  'sent', // Successfully sent via Postmark
  'failed', // Failed after all retries
  'rate-limited', // Blocked by rate limiter
]);
export type EmailQueueStatus = z.infer<typeof EmailQueueStatusSchema>;

// ===== Sub-schemas =====

/**
 * Sender information (optional override)
 */
export const EmailSenderSchema = z.object({
  email: z.string().email().describe('Sender email address'),
  name: z.string().optional().describe('Sender display name'),
});
export type EmailSender = z.infer<typeof EmailSenderSchema>;

/**
 * Email metadata for tracking and filtering
 */
export const EmailMetadataSchema = z
  .object({
    userId: z.string().optional().describe('User who triggered the email'),
    organizationId: z.string().optional().describe('Related organisation'),
    eventId: z.string().optional().describe('Related event'),
    brandId: z.string().optional().describe('Related brand'),
    campaignId: z.string().optional().describe('Marketing campaign ID'),
  })
  .passthrough(); // Allow additional fields
export type EmailMetadata = z.infer<typeof EmailMetadataSchema>;

/**
 * Error details when email fails
 */
export const EmailErrorSchema = z.object({
  code: z.string().describe('Error code (e.g., RATE_LIMIT_EXCEEDED)'),
  message: z.string().describe('Human-readable error message'),
  timestamp: z.date().describe('When the error occurred'),
});
export type EmailError = z.infer<typeof EmailErrorSchema>;

// ===== Main Schema =====

/**
 * Email queue document schema
 *
 * Represents an email waiting to be processed (or already processed) by Cloud Functions.
 */
export const EmailQueueDocumentSchema = z.object({
  // Core fields
  type: EmailTypeSchema.describe('Email type for rate limiting'),
  deliveryMode: DeliveryModeSchema.describe('immediate or batch processing'),
  status: EmailQueueStatusSchema.describe('Current processing status'),

  // Recipient
  to: z.string().email().describe('Recipient email address (normalised to lowercase)'),

  // Postmark template
  templateAlias: z.string().min(1).describe('Postmark template alias'),
  templateData: z.record(z.unknown()).describe('Variables for template interpolation'),

  // Optional sender override
  from: EmailSenderSchema.optional().describe('Override default sender'),
  replyTo: z.string().email().optional().describe('Reply-to address'),

  // Metadata
  metadata: EmailMetadataSchema.describe('Tracking and filtering metadata'),

  // Timestamps
  createdAt: z.date().describe('When email was queued'),
  processedAt: z.date().optional().describe('When Cloud Function picked it up'),
  sentAt: z.date().optional().describe('When Postmark confirmed send'),

  // Delivery tracking
  attempts: z.number().int().min(0).describe('Send attempt count'),
  lastAttemptAt: z.date().optional().describe('When last attempt was made'),
  postmarkMessageId: z.string().optional().describe('Postmark message ID on success'),

  // Error handling
  error: EmailErrorSchema.optional().describe('Error details if failed'),

  // Rate limiting context
  rateLimitScope: z.string().optional().describe('e.g., user:abc123 or organization:org-456'),
});

export type EmailQueueDocument = z.infer<typeof EmailQueueDocumentSchema>;

/**
 * Email queue document with typed ID
 */
export interface EmailQueueDocumentWithId extends EmailQueueDocument {
  id: EmailQueueId;
}

// ===== Create Schema =====

/**
 * Data required to queue a new email
 * Omits server-set fields (timestamps, status, attempts, etc.)
 */
export const CreateEmailQueueSchema = z.object({
  type: EmailTypeSchema,
  deliveryMode: DeliveryModeSchema,
  to: z.string().email(),
  templateAlias: z.string().min(1),
  templateData: z.record(z.unknown()),
  from: EmailSenderSchema.optional(),
  replyTo: z.string().email().optional(),
  metadata: EmailMetadataSchema,
  rateLimitScope: z.string().optional(),
});

export type CreateEmailQueueData = z.infer<typeof CreateEmailQueueSchema>;

// ===== Validation Functions =====

/**
 * Validate email queue document data
 * @throws ZodError if validation fails
 */
export function validateEmailQueueDocument(data: unknown): EmailQueueDocument {
  return EmailQueueDocumentSchema.parse(data);
}

/**
 * Validate create email queue data
 * @throws ZodError if validation fails
 */
export function validateCreateEmailQueueData(data: unknown): CreateEmailQueueData {
  return CreateEmailQueueSchema.parse(data);
}

/**
 * Safe validation that returns result object
 */
export function safeValidateCreateEmailQueueData(data: unknown): {
  success: boolean;
  data?: CreateEmailQueueData;
  error?: z.ZodError;
} {
  const result = CreateEmailQueueSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

// ===== Helper Functions =====

/**
 * Determine the rate limit scope for an email
 */
export function getRateLimitScope(
  type: EmailType,
  metadata: EmailMetadata
): string {
  switch (type) {
    case 'password-reset':
    case 'verification':
      // Per-user rate limiting
      return metadata.userId ? `user:${metadata.userId}` : 'global';

    case 'invitation':
    case 'organization-deletion':
    case 'billing-invoice':
      // Per-organization rate limiting
      return metadata.organizationId ? `organization:${metadata.organizationId}` : 'global';

    case 'event-reminder':
    case 'weekly-digest':
    case 'marketing':
      // Global rate limiting for bulk emails
      return 'global';

    default:
      return 'global';
  }
}

/**
 * Determine the delivery mode for an email type
 */
export function getDefaultDeliveryMode(type: EmailType): DeliveryMode {
  switch (type) {
    case 'invitation':
    case 'password-reset':
    case 'verification':
    case 'organization-deletion':
    case 'billing-invoice':
      return 'immediate';

    case 'event-reminder':
    case 'weekly-digest':
    case 'marketing':
      return 'batch';

    default:
      return 'immediate';
  }
}

/**
 * Check if an email type is transactional (requires immediate delivery)
 */
export function isTransactionalEmail(type: EmailType): boolean {
  return getDefaultDeliveryMode(type) === 'immediate';
}

/**
 * Check if an email type is bulk (can be batched)
 */
export function isBulkEmail(type: EmailType): boolean {
  return getDefaultDeliveryMode(type) === 'batch';
}

// ===== Rate Limit Config =====

/**
 * Rate limit configuration for each email type
 */
export interface RateLimitConfig {
  maxPerMinute: number;
  scope: 'user' | 'organization' | 'global';
}

/**
 * Default rate limits by email type
 */
export const EMAIL_RATE_LIMITS: Record<EmailType, RateLimitConfig> = {
  invitation: { maxPerMinute: 10, scope: 'organization' },
  'password-reset': { maxPerMinute: 5, scope: 'user' },
  verification: { maxPerMinute: 5, scope: 'user' },
  'event-reminder': { maxPerMinute: 100, scope: 'global' },
  'weekly-digest': { maxPerMinute: 100, scope: 'global' },
  marketing: { maxPerMinute: 100, scope: 'global' },
  'billing-invoice': { maxPerMinute: 20, scope: 'organization' },
  'organization-deletion': { maxPerMinute: 1, scope: 'organization' },
};

// ===== Test Factory =====

/**
 * Create a mock email queue document for testing
 */
export function createMockEmailQueueDocument(
  overrides: Partial<EmailQueueDocument> = {}
): EmailQueueDocument {
  return {
    type: 'invitation',
    deliveryMode: 'immediate',
    status: 'pending',
    to: 'test@example.com',
    templateAlias: 'brayford-invitation-member',
    templateData: {
      organizationName: 'Test Org',
      inviterName: 'Test User',
      inviteLink: 'https://example.com/invite/abc123',
    },
    metadata: {
      userId: 'user-123',
      organizationId: 'org-456',
    },
    createdAt: new Date(),
    attempts: 0,
    ...overrides,
  };
}
