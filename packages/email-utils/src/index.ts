/**
 * @brayford/email-utils
 * 
 * Email sending utilities for Project Brayford
 * Provides Postmark integration with rate limiting, dev mode, and template validation
 */

// Core email sending
export { sendEmail, sendEmailBatch, testPostmarkConnection, EmailSendError } from './client';

// Configuration
export { emailConfig, getEmailConfig, validateEmailConfig } from './config';

// Rate limiting
export {
  getRateLimiter,
  checkRateLimit,
  withRateLimit,
  RateLimiter,
  RateLimitError,
  shouldApplyRateLimit,
} from './rate-limiter';

// Templates
export {
  TEMPLATES,
  getTemplate,
  validateTemplateData,
  getAllTemplateAliases,
  isTemplateRegistered,
} from './templates/registry';
export type { TemplateDefinition } from './templates/index';

// Schemas
export {
  EmailTypeSchema,
  EmailSenderSchema,
  SendEmailOptionsSchema,
  RateLimitOptionsSchema,
  validateSendEmailOptions,
  validateRateLimitOptions,
} from './schemas';

// Types
export type {
  EmailId,
  EmailType,
  EmailSender,
  SendEmailOptions,
  EmailMetadata,
  EmailResult,
  RateLimitConfig,
  RateLimitOptions,
  RateLimitResult,
  EmailConfig,
} from './types';

// Utilities
export { isDevMode, logEmailToConsole, createMockEmailResult } from './utils/dev-mode';
export { isValidEmail, normalizeEmail, isTestEmail } from './utils/validation';
