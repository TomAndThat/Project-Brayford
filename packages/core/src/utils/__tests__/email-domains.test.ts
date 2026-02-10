/**
 * Email Domain Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import {
  extractDomain,
  normaliseDomain,
  isFreeDomainEmail,
  validateEmailForOrg,
  domainMatchesAllowed,
  FREE_EMAIL_PROVIDERS,
} from '../email-domains';

describe('extractDomain', () => {
  it('should extract domain from valid email', () => {
    expect(extractDomain('user@example.com')).toBe('example.com');
    expect(extractDomain('john.doe@bbc.co.uk')).toBe('bbc.co.uk');
  });

  it('should handle emails with uppercase', () => {
    expect(extractDomain('User@Example.COM')).toBe('example.com');
  });

  it('should handle emails with spaces', () => {
    expect(extractDomain('  user@example.com  ')).toBe('example.com');
  });

  it('should throw on invalid email format', () => {
    expect(() => extractDomain('notanemail')).toThrow('Invalid email format');
    expect(() => extractDomain('@example.com')).toThrow('Invalid email format');
    expect(() => extractDomain('user@')).toThrow('Invalid email format');
  });
});

describe('normaliseDomain', () => {
  it('should remove common subdomains', () => {
    expect(normaliseDomain('mail.google.com')).toBe('google.com');
    expect(normaliseDomain('news.bbc.co.uk')).toBe('bbc.co.uk');
    expect(normaliseDomain('www.example.com')).toBe('example.com');
  });

  it('should preserve non-standard subdomains', () => {
    expect(normaliseDomain('api.example.com')).toBe('api.example.com');
    expect(normaliseDomain('admin.example.com')).toBe('admin.example.com');
  });

  it('should handle domains without subdomains', () => {
    expect(normaliseDomain('example.com')).toBe('example.com');
    expect(normaliseDomain('google.com')).toBe('google.com');
  });

  it('should handle uppercase and whitespace', () => {
    expect(normaliseDomain('  WWW.Example.COM  ')).toBe('example.com');
  });
});

describe('isFreeDomainEmail', () => {
  it('should identify common free email providers', () => {
    expect(isFreeDomainEmail('user@gmail.com')).toBe(true);
    expect(isFreeDomainEmail('user@hotmail.com')).toBe(true);
    expect(isFreeDomainEmail('user@yahoo.com')).toBe(true);
    expect(isFreeDomainEmail('user@outlook.com')).toBe(true);
  });

  it('should identify corporate domains as not free', () => {
    expect(isFreeDomainEmail('user@bbc.co.uk')).toBe(false);
    expect(isFreeDomainEmail('user@microsoft.com')).toBe(false);
    expect(isFreeDomainEmail('user@acme.com')).toBe(false);
  });

  it('should handle subdomains of free providers', () => {
    expect(isFreeDomainEmail('user@mail.gmail.com')).toBe(true);
  });

  it('should return false for invalid emails', () => {
    expect(isFreeDomainEmail('notanemail')).toBe(false);
  });

  it('should be case insensitive', () => {
    expect(isFreeDomainEmail('user@GMAIL.COM')).toBe(true);
  });
});

describe('validateEmailForOrg', () => {
  it('should allow any email when domain match not required', () => {
    const result = validateEmailForOrg(
      'user@gmail.com',
      false,
      ['bbc.co.uk'],
      'flat_rate'
    );
    expect(result.valid).toBe(true);
  });

  it('should reject emails not matching allowed domains for flat_rate tier', () => {
    const result = validateEmailForOrg(
      'user@gmail.com',
      true,
      ['bbc.co.uk'],
      'flat_rate'
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('domain_mismatch');
  });

  it('should accept emails matching allowed domains', () => {
    const result = validateEmailForOrg(
      'user@bbc.co.uk',
      true,
      ['bbc.co.uk'],
      'flat_rate'
    );
    expect(result.valid).toBe(true);
  });

  it('should accept subdomains of allowed domains', () => {
    const result = validateEmailForOrg(
      'user@news.bbc.co.uk',
      true,
      ['bbc.co.uk'],
      'flat_rate'
    );
    expect(result.valid).toBe(true);
  });

  it('should reject invalid email format', () => {
    const result = validateEmailForOrg(
      'notanemail',
      true,
      ['bbc.co.uk'],
      'flat_rate'
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('invalid_format');
  });

  it('should allow any email for per_brand tier even with enforcement', () => {
    const result = validateEmailForOrg(
      'user@gmail.com',
      true,
      [],
      'per_brand'
    );
    expect(result.valid).toBe(true);
  });
});

describe('domainMatchesAllowed', () => {
  it('should return true when no restrictions', () => {
    expect(domainMatchesAllowed('example.com', [])).toBe(true);
  });

  it('should match exact domain', () => {
    expect(domainMatchesAllowed('bbc.co.uk', ['bbc.co.uk'])).toBe(true);
  });

  it('should match subdomains', () => {
    expect(domainMatchesAllowed('news.bbc.co.uk', ['bbc.co.uk'])).toBe(true);
  });

  it('should reject non-matching domains', () => {
    expect(domainMatchesAllowed('gmail.com', ['bbc.co.uk'])).toBe(false);
  });

  it('should match multiple allowed domains', () => {
    expect(domainMatchesAllowed('bbc.co.uk', ['bbc.co.uk', 'bbc.com'])).toBe(true);
    expect(domainMatchesAllowed('bbc.com', ['bbc.co.uk', 'bbc.com'])).toBe(true);
  });

  it('should be case insensitive', () => {
    expect(domainMatchesAllowed('BBC.CO.UK', ['bbc.co.uk'])).toBe(true);
  });
});

describe('FREE_EMAIL_PROVIDERS', () => {
  it('should include major providers', () => {
    expect(FREE_EMAIL_PROVIDERS).toContain('gmail.com');
    expect(FREE_EMAIL_PROVIDERS).toContain('hotmail.com');
    expect(FREE_EMAIL_PROVIDERS).toContain('yahoo.com');
    expect(FREE_EMAIL_PROVIDERS).toContain('outlook.com');
  });

  it('should have reasonable size', () => {
    expect(FREE_EMAIL_PROVIDERS.length).toBeGreaterThan(50);
  });
});
