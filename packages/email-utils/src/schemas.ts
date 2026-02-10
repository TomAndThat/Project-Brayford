/**
 * Email Utilities - Zod Schemas
 * 
 * Validation schemas for email operations
 */

import { z } from 'zod';

/**
 * Email type enum schema
 */
export const EmailTypeSchema = z.enum([
  'invitation',
  'password-reset',
  'verification',
  'event-reminder',
  'weekly-digest',
  'marketing',
  'billing-invoice',
  'organization-deletion',
]);

/**
 * Email sender schema
 */
export const EmailSenderSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().optional(),
});

/**
 * Send email options schema
 */
export const SendEmailOptionsSchema = z.object({
  type: EmailTypeSchema,
  to: z.string().email('Invalid recipient email address'),
  templateAlias: z.string().min(1, 'Template alias is required'),
  templateData: z.record(z.unknown()),
  from: EmailSenderSchema.optional(),
  replyTo: z.string().email('Invalid reply-to email address').optional(),
  metadata: z.record(z.unknown()).optional(),
  locale: z.string().optional(),
});

/**
 * Rate limit options schema
 */
export const RateLimitOptionsSchema = z.object({
  type: EmailTypeSchema,
  scopeId: z.string().min(1, 'Scope ID is required'),
});

/**
 * Validate send email options
 */
export function validateSendEmailOptions(data: unknown) {
  return SendEmailOptionsSchema.parse(data);
}

/**
 * Validate rate limit options
 */
export function validateRateLimitOptions(data: unknown) {
  return RateLimitOptionsSchema.parse(data);
}
