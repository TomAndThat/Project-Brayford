/**
 * Email Module
 *
 * Cloud Functions-based email delivery system with:
 * - Firestore queue for reliable delivery
 * - Distributed rate limiting
 * - Development mode (console logging)
 * - Postmark integration
 */

// Configuration
export { getEmailConfig, isDevMode, getRateLimitForType, logEmailConfig } from './config';

// Rate limiting
export {
  checkRateLimit,
  incrementRateLimit,
  checkAndIncrementRateLimit,
  resetRateLimit,
  type RateLimitResult,
} from './rate-limiter';

// Postmark client
export { sendEmail, testPostmarkConnection, type SendResult } from './postmark-client';

// Dev mode utilities
export { logEmailToConsole, createMockEmailResult, logBatchSummary } from './dev-mode';
