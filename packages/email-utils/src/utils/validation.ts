/**
 * Validation Utilities
 * 
 * Helper functions for email validation
 */

/**
 * Basic email validation regex
 * More comprehensive validation is done by Zod schemas
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

/**
 * Normalize email address (lowercase, trim)
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Check if email is a test/sandbox address
 * Postmark accepts these for testing
 */
export function isTestEmail(email: string): boolean {
  const testDomains = ['postmarkapp.com', 'example.com', 'test.com'];
  const domain = email.split('@')[1]?.toLowerCase();
  return testDomains.includes(domain || '');
}
