/**
 * Email Domain Utilities
 * 
 * Utilities for validating email domains and determining billing tiers.
 * Used to prevent subscription sharing by enforcing corporate email domains.
 */

/**
 * Comprehensive list of free email providers
 * Used to determine billing tier on organization creation
 */
export const FREE_EMAIL_PROVIDERS = [
  // Major providers
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.fr',
  'yahoo.de',
  'outlook.com',
  'hotmail.com',
  'hotmail.co.uk',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  
  // Popular international providers
  'mail.ru',
  'yandex.ru',
  'yandex.com',
  'gmx.com',
  'gmx.de',
  'web.de',
  'zoho.com',
  'zohomail.com',
  
  // Other common free providers
  'inbox.com',
  'mail.com',
  'aim.com',
  'fastmail.com',
  'hushmail.com',
  'tutanota.com',
  'tutamail.com',
  'mailinator.com',
  'guerrillamail.com',
  'temp-mail.org',
  '10minutemail.com',
  'throwaway.email',
  
  // Regional providers
  'qq.com',
  '163.com',
  '126.com',
  'sina.com',
  'naver.com',
  'daum.net',
  'rediffmail.com',
  'libero.it',
  'orange.fr',
  'wanadoo.fr',
  'tiscali.it',
  'virgilio.it',
  'btinternet.com',
  'talktalk.net',
  'sky.com',
  
  // Disposable/temporary email services
  'tempmail.com',
  'fakeinbox.com',
  'maildrop.cc',
  'getnada.com',
  'guerrillamail.info',
  'sharklasers.com',
  'grr.la',
  'guerrillamail.biz',
  'guerrillamail.de',
  'spam4.me',
  'trash-mail.com',
  'yopmail.com',
] as const;

/**
 * Extract domain from email address
 * @param email - Email address
 * @returns Domain portion (e.g., 'example.com' from 'user@example.com')
 * @throws Error if email format is invalid
 */
export function extractDomain(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.lastIndexOf('@');
  
  if (atIndex === -1 || atIndex === 0 || atIndex === trimmed.length - 1) {
    throw new Error(`Invalid email format: ${email}`);
  }
  
  return trimmed.slice(atIndex + 1);
}

/**
 * Normalise domain by removing common subdomain prefixes
 * Handles cases like news.bbc.co.uk → bbc.co.uk
 * 
 * @param domain - Domain to normalise
 * @returns Normalised domain (base domain without common subdomains)
 */
export function normaliseDomain(domain: string): string {
  const parts = domain.toLowerCase().trim().split('.');
  
  // If domain has 3+ parts and first part is a common subdomain, strip it
  // e.g., mail.google.com → google.com, news.bbc.co.uk → bbc.co.uk
  if (parts.length >= 3 && parts[0]) {
    const commonSubdomains = ['mail', 'email', 'webmail', 'smtp', 'www', 'mx', 'news', 'blog'];
    if (commonSubdomains.includes(parts[0])) {
      return parts.slice(1).join('.');
    }
  }
  
  return domain;
}

/**
 * Check if email address uses a free email provider
 * @param email - Email address to check
 * @returns True if domain is in free provider list
 */
export function isFreeDomainEmail(email: string): boolean {
  try {
    const domain = extractDomain(email);
    const normalised = normaliseDomain(domain);
    return FREE_EMAIL_PROVIDERS.includes(normalised as typeof FREE_EMAIL_PROVIDERS[number]);
  } catch {
    // If email parsing fails, treat as invalid (not free)
    return false;
  }
}

/**
 * Result of email validation against organization domain requirements
 */
export interface EmailValidationResult {
  valid: boolean;
  reason?: 'free_email' | 'domain_mismatch' | 'invalid_format';
  message?: string;
}

/**
 * Validate email against organization domain requirements
 * Used for invitation enforcement when requireDomainMatch is enabled
 * 
 * @param email - Email address to validate
 * @param requireDomainMatch - Whether domain matching is enforced
 * @param allowedDomains - Array of allowed domains (empty = any)
 * @param billingTier - Organization's billing tier
 * @returns Validation result with details
 */
export function validateEmailForOrg(
  email: string,
  requireDomainMatch: boolean,
  allowedDomains: string[],
  billingTier: 'per_brand' | 'flat_rate'
): EmailValidationResult {
  // Extract and validate email format
  let domain: string;
  try {
    domain = extractDomain(email);
  } catch {
    return {
      valid: false,
      reason: 'invalid_format',
      message: 'Invalid email address format',
    };
  }
  
  // If domain matching not required, allow any valid email
  if (!requireDomainMatch) {
    return { valid: true };
  }
  
  // For flat_rate tier with domain enforcement, check against allowed domains
  if (billingTier === 'flat_rate' && allowedDomains.length > 0) {
    const normalisedDomain = normaliseDomain(domain);
    const isAllowed = allowedDomains.some(
      (allowed) => normalisedDomain === allowed.toLowerCase() || domain.endsWith(`.${allowed.toLowerCase()}`)
    );
    
    if (!isAllowed) {
      return {
        valid: false,
        reason: 'domain_mismatch',
        message: `Email must be from one of: ${allowedDomains.join(', ')}`,
      };
    }
  }
  
  return { valid: true };
}

/**
 * Check if domain matches at least one allowed domain
 * Supports both exact match and subdomain matching
 * 
 * @param emailDomain - Domain from email address
 * @param allowedDomains - Array of allowed domains
 * @returns True if domain matches any allowed domain
 */
export function domainMatchesAllowed(emailDomain: string, allowedDomains: string[]): boolean {
  if (allowedDomains.length === 0) {
    return true; // Empty array means no restrictions
  }
  
  const normalisedDomain = normaliseDomain(emailDomain).toLowerCase();
  
  return allowedDomains.some((allowed) => {
    const allowedLower = allowed.toLowerCase();
    return (
      normalisedDomain === allowedLower ||
      emailDomain.toLowerCase().endsWith(`.${allowedLower}`)
    );
  });
}
