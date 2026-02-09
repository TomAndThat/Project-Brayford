/**
 * Validation Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import { isValidEmail, normalizeEmail, isTestEmail } from '../utils/validation';

describe('Validation Utilities', () => {
  describe('isValidEmail', () => {
    it('validates correct email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@example.com')).toBe(true);
      expect(isValidEmail('user+tag@example.co.uk')).toBe(true);
      expect(isValidEmail('name@subdomain.example.com')).toBe(true);
    });
    
    it('rejects invalid email addresses', () => {
      expect(isValidEmail('not-an-email')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('test@.com')).toBe(false);
      expect(isValidEmail('test @example.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });
  
  describe('normalizeEmail', () => {
    it('converts to lowercase', () => {
      expect(normalizeEmail('TEST@EXAMPLE.COM')).toBe('test@example.com');
      expect(normalizeEmail('User@Example.Com')).toBe('user@example.com');
    });
    
    it('trims whitespace', () => {
      expect(normalizeEmail('  test@example.com  ')).toBe('test@example.com');
      expect(normalizeEmail('\ttest@example.com\n')).toBe('test@example.com');
    });
    
    it('combines lowercase and trim', () => {
      expect(normalizeEmail('  TEST@EXAMPLE.COM  ')).toBe('test@example.com');
    });
    
    it('handles already normalized emails', () => {
      expect(normalizeEmail('test@example.com')).toBe('test@example.com');
    });
  });
  
  describe('isTestEmail', () => {
    it('identifies Postmark test emails', () => {
      expect(isTestEmail('test@postmarkapp.com')).toBe(true);
      expect(isTestEmail('anything@postmarkapp.com')).toBe(true);
      expect(isTestEmail('sandbox@postmarkapp.com')).toBe(true);
    });
    
    it('identifies common test domains', () => {
      expect(isTestEmail('test@example.com')).toBe(true);
      expect(isTestEmail('user@test.com')).toBe(true);
    });
    
    it('rejects real email addresses', () => {
      expect(isTestEmail('user@gmail.com')).toBe(false);
      expect(isTestEmail('contact@brayford.app')).toBe(false);
      expect(isTestEmail('team@company.co.uk')).toBe(false);
    });
    
    it('handles case insensitivity', () => {
      expect(isTestEmail('TEST@EXAMPLE.COM')).toBe(true);
      expect(isTestEmail('User@PostmarkApp.COM')).toBe(true);
    });
  });
});
