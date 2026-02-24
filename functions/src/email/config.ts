/**
 * Email Module Configuration
 *
 * Centralises environment variable access and configuration for the email system.
 * Uses Firestore-backed rate limiting for distributed Cloud Functions.
 */

import * as logger from 'firebase-functions/logger';
import type { EmailType, RateLimitConfig } from '@brayford/core';
import { EMAIL_RATE_LIMITS } from '@brayford/core';

// ===== Environment Configuration =====

/**
 * Email configuration from environment variables
 */
export interface EmailConfig {
  postmark: {
    apiKey: string;
    fromEmail: string;
    fromName: string;
  };
  devMode: boolean;
  rateLimits: Record<EmailType, number>;
  /**
   * Variables automatically injected into any Postmark template whose alias
   * starts with the PB_ADMIN_LAYOUT_PREFIX. These variables are required by
   * the 'pb-admin' Postmark layout that wraps creator-facing admin emails.
   */
  pbAdminLayout: {
    productName: string;
    productUrl: string;
    companyName: string;
    companyAddress: string;
  };
}

/**
 * Alias prefix that identifies templates using the 'pb-admin' Postmark layout.
 * Any template whose alias begins with this string will have layout variables
 * automatically merged into its TemplateModel at send time.
 */
export const PB_ADMIN_LAYOUT_PREFIX = 'pb-admin-' as const;

/**
 * Returns true when the given template alias uses the 'pb-admin' layout,
 * meaning layout variables should be injected automatically.
 */
export function usesPbAdminLayout(templateAlias: string): boolean {
  return templateAlias.startsWith(PB_ADMIN_LAYOUT_PREFIX);
}

/**
 * Get email configuration from environment
 * @throws Error if required environment variables are missing
 */
export function getEmailConfig(): EmailConfig {
  const apiKey = process.env.POSTMARK_API_KEY;
  const fromEmail = process.env.POSTMARK_FROM_EMAIL;
  const fromName = process.env.POSTMARK_FROM_NAME || 'Project Brayford';
  const devMode = process.env.EMAIL_DEV_MODE === 'true';

  // Validate required config (only in production mode)
  if (!devMode) {
    if (!apiKey) {
      throw new Error('POSTMARK_API_KEY environment variable is required in production mode');
    }
    if (!fromEmail) {
      throw new Error('POSTMARK_FROM_EMAIL environment variable is required in production mode');
    }
  }

  // Parse rate limit overrides from environment
  const rateLimits = {
    invitation: parseInt(process.env.EMAIL_RATE_LIMIT_INVITATION || '') || EMAIL_RATE_LIMITS['invitation'].maxPerMinute,
    'org-owner-invitation': parseInt(process.env.EMAIL_RATE_LIMIT_ORG_OWNER_INVITATION || '') || EMAIL_RATE_LIMITS['org-owner-invitation'].maxPerMinute,
    'password-reset': parseInt(process.env.EMAIL_RATE_LIMIT_PASSWORD_RESET || '') || EMAIL_RATE_LIMITS['password-reset'].maxPerMinute,
    verification: parseInt(process.env.EMAIL_RATE_LIMIT_VERIFICATION || '') || EMAIL_RATE_LIMITS['verification'].maxPerMinute,
    'event-reminder': parseInt(process.env.EMAIL_RATE_LIMIT_EVENT_REMINDER || '') || EMAIL_RATE_LIMITS['event-reminder'].maxPerMinute,
    'weekly-digest': parseInt(process.env.EMAIL_RATE_LIMIT_WEEKLY_DIGEST || '') || EMAIL_RATE_LIMITS['weekly-digest'].maxPerMinute,
    marketing: parseInt(process.env.EMAIL_RATE_LIMIT_MARKETING || '') || EMAIL_RATE_LIMITS['marketing'].maxPerMinute,
    'billing-invoice': parseInt(process.env.EMAIL_RATE_LIMIT_BILLING_INVOICE || '') || EMAIL_RATE_LIMITS['billing-invoice'].maxPerMinute,
    'organization-deletion': parseInt(process.env.EMAIL_RATE_LIMIT_ORGANIZATION_DELETION || '') || EMAIL_RATE_LIMITS['organization-deletion'].maxPerMinute,
  } as Record<EmailType, number>;

  return {
    postmark: {
      apiKey: apiKey || '',
      fromEmail: fromEmail || 'noreply@brayford.live',
      fromName,
    },
    devMode,
    rateLimits,
    pbAdminLayout: {
      productName: process.env.POSTMARK_PRODUCT_NAME || 'Project Brayford',
      productUrl: process.env.POSTMARK_PRODUCT_URL || 'https://brayford.live',
      companyName: process.env.BF_COMPANY_NAME || 'Project Brayford',
      companyAddress: process.env.BF_COMPANY_ADDRESS || '',
    },
  };
}

/**
 * Check if running in development mode
 */
export function isDevMode(): boolean {
  return process.env.EMAIL_DEV_MODE === 'true';
}

/**
 * Get rate limit for an email type
 */
export function getRateLimitForType(type: EmailType): RateLimitConfig {
  const config = getEmailConfig();
  const baseConfig = EMAIL_RATE_LIMITS[type];
  
  return {
    ...baseConfig,
    maxPerMinute: config.rateLimits[type] || baseConfig.maxPerMinute,
  };
}

/**
 * Log configuration on startup (without sensitive data)
 */
export function logEmailConfig(): void {
  const config = getEmailConfig();
  
  logger.info('📧 Email configuration loaded', {
    devMode: config.devMode,
    fromEmail: config.postmark.fromEmail,
    fromName: config.postmark.fromName,
    hasApiKey: !!config.postmark.apiKey,
    pbAdminLayout: {
      productName: config.pbAdminLayout.productName,
      productUrl: config.pbAdminLayout.productUrl,
      companyName: config.pbAdminLayout.companyName,
      hasCompanyAddress: !!config.pbAdminLayout.companyAddress,
    },
  });
}
