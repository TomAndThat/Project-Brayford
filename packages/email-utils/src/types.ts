/**
 * Email Utilities - Type Definitions
 * 
 * TypeScript types and branded IDs for email operations
 */

import type { OrganizationId, UserId, EventId, BrandId } from '@brayford/core';

/**
 * Branded type for email IDs
 */
export type EmailId = string & { readonly __brand: 'EmailId' };

/**
 * Email type enum - determines rate limiting and queuing behaviour
 */
export type EmailType =
  | 'invitation'           // Organisation member invitations
  | 'password-reset'       // Password reset requests
  | 'verification'         // Email verification
  | 'event-reminder'       // Event reminders (bulk)
  | 'weekly-digest'        // Weekly summaries (bulk)
  | 'marketing'            // Marketing campaigns (bulk)
  | 'billing-invoice';     // Payment receipts

/**
 * Sender information
 */
export interface EmailSender {
  email: string;
  name?: string;
}

/**
 * Options for sending an email
 */
export interface SendEmailOptions {
  /** Email type (affects rate limiting) */
  type: EmailType;
  
  /** Recipient email address */
  to: string;
  
  /** Postmark template alias */
  templateAlias: string;
  
  /** Template variables (template-specific) */
  templateData: Record<string, unknown>;
  
  /** Override default sender (optional) */
  from?: EmailSender;
  
  /** Reply-to address (optional) */
  replyTo?: string;
  
  /** Additional metadata for tracking (optional) */
  metadata?: EmailMetadata;
  
  /** Locale for i18n (future use) */
  locale?: string;
}

/**
 * Metadata attached to emails for tracking and context
 */
export interface EmailMetadata {
  organizationId?: OrganizationId;
  userId?: UserId;
  eventId?: EventId;
  brandId?: BrandId;
  [key: string]: unknown;
}

/**
 * Result of sending an email
 */
export interface EmailResult {
  /** Unique email ID */
  emailId: EmailId;
  
  /** Postmark message ID */
  messageId: string;
  
  /** Timestamp when sent */
  sentAt: Date;
  
  /** Recipient email */
  to: string;
  
  /** Email type */
  type: EmailType;
  
  /** Whether this was actually sent or logged (dev mode) */
  devMode: boolean;
}

/**
 * Rate limit configuration for an email type
 */
export interface RateLimitConfig {
  /** Maximum emails per minute */
  maxPerMinute: number;
  
  /** Scope of rate limiting */
  scope: 'user' | 'organization' | 'global';
}

/**
 * Options for rate limiting
 */
export interface RateLimitOptions {
  /** Email type */
  type: EmailType;
  
  /** Scope identifier (user ID, org ID, or 'global') */
  scopeId: string;
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  
  /** Number of requests remaining in window */
  remaining: number;
  
  /** When the rate limit resets (seconds from now) */
  retryAfter?: number;
}

/**
 * Email configuration loaded from environment
 */
export interface EmailConfig {
  postmark: {
    apiKey: string;
    fromEmail: string;
    fromName: string;
  };
  devMode: boolean;
  defaultLocale: string;
  rateLimits: Record<EmailType, number>;
}
