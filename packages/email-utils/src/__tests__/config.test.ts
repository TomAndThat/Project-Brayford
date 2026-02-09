/**
 * Configuration Tests
 */

import { describe, it, expect, afterEach } from 'vitest';
import { getEmailConfig, validateEmailConfig } from '../config';

describe('Email Configuration', () => {
  const originalEnv = { ...process.env };
  
  afterEach(() => {
    process.env = { ...originalEnv };
  });
  
  describe('getEmailConfig', () => {
    it('loads configuration from environment variables', () => {
      process.env.POSTMARK_API_KEY = 'test-api-key';
      process.env.POSTMARK_FROM_EMAIL = 'test@example.com';
      process.env.POSTMARK_FROM_NAME = 'Test Sender';
      process.env.EMAIL_DEV_MODE = 'false';
      
      const config = getEmailConfig();
      
      expect(config.postmark.apiKey).toBe('test-api-key');
      expect(config.postmark.fromEmail).toBe('test@example.com');
      expect(config.postmark.fromName).toBe('Test Sender');
      expect(config.devMode).toBe(false);
    });
    
    it('uses default values when env vars not set', () => {
      delete process.env.POSTMARK_FROM_EMAIL;
      delete process.env.POSTMARK_FROM_NAME;
      
      const config = getEmailConfig();
      
      expect(config.postmark.fromEmail).toBe('noreply@brayford.app');
      expect(config.postmark.fromName).toBe('Brayford Platform');
    });
    
    it('sets devMode based on EMAIL_DEV_MODE', () => {
      process.env.EMAIL_DEV_MODE = 'true';
      expect(getEmailConfig().devMode).toBe(true);
      
      process.env.EMAIL_DEV_MODE = 'false';
      expect(getEmailConfig().devMode).toBe(false);
      
      delete process.env.EMAIL_DEV_MODE;
      expect(getEmailConfig().devMode).toBe(false);
    });
    
    it('loads custom rate limits from environment', () => {
      process.env.EMAIL_RATE_LIMIT_INVITATION = '20';
      process.env.EMAIL_RATE_LIMIT_PASSWORD_RESET = '10';
      
      const config = getEmailConfig();
      
      expect(config.rateLimits.invitation).toBe(20);
      expect(config.rateLimits['password-reset']).toBe(10);
    });
    
    it('uses default rate limits when not set', () => {
      delete process.env.EMAIL_RATE_LIMIT_INVITATION;
      delete process.env.EMAIL_RATE_LIMIT_PASSWORD_RESET;
      
      const config = getEmailConfig();
      
      expect(config.rateLimits.invitation).toBe(10);
      expect(config.rateLimits['password-reset']).toBe(5);
    });
    
    it('sets default locale to en-GB', () => {
      const config = getEmailConfig();
      expect(config.defaultLocale).toBe('en-GB');
    });
    
    it('throws error when API key missing in production mode', () => {
      delete process.env.POSTMARK_API_KEY;
      process.env.EMAIL_DEV_MODE = 'false';
      
      expect(() => getEmailConfig()).toThrow('POSTMARK_API_KEY environment variable is required');
    });
    
    it('allows missing API key in dev mode', () => {
      delete process.env.POSTMARK_API_KEY;
      process.env.EMAIL_DEV_MODE = 'true';
      
      expect(() => getEmailConfig()).not.toThrow();
    });
  });
  
  describe('validateEmailConfig', () => {
    it('validates correct configuration', () => {
      const config = {
        postmark: {
          apiKey: 'test-key',
          fromEmail: 'test@example.com',
          fromName: 'Test',
        },
        devMode: false,
        defaultLocale: 'en-GB',
        rateLimits: {
          invitation: 10,
          'password-reset': 5,
          verification: 5,
          'event-reminder': 100,
          'weekly-digest': 100,
          marketing: 100,
          'billing-invoice': 20,
        },
      };
      
      expect(() => validateEmailConfig(config)).not.toThrow();
    });
    
    it('throws when API key missing in production', () => {
      const config = {
        postmark: {
          apiKey: '',
          fromEmail: 'test@example.com',
          fromName: 'Test',
        },
        devMode: false,
        defaultLocale: 'en-GB',
        rateLimits: {} as any,
      };
      
      expect(() => validateEmailConfig(config)).toThrow('Postmark API key is required');
    });
    
    it('allows missing API key in dev mode', () => {
      const config = {
        postmark: {
          apiKey: '',
          fromEmail: 'test@example.com',
          fromName: 'Test',
        },
        devMode: true,
        defaultLocale: 'en-GB',
        rateLimits: {} as any,
      };
      
      expect(() => validateEmailConfig(config)).not.toThrow();
    });
    
    it('throws when from email is missing', () => {
      const config = {
        postmark: {
          apiKey: 'test-key',
          fromEmail: '',
          fromName: 'Test',
        },
        devMode: false,
        defaultLocale: 'en-GB',
        rateLimits: {} as any,
      };
      
      expect(() => validateEmailConfig(config)).toThrow('Postmark from email is required');
    });
    
    it('throws when from email format is invalid', () => {
      const config = {
        postmark: {
          apiKey: 'test-key',
          fromEmail: 'not-an-email',
          fromName: 'Test',
        },
        devMode: false,
        defaultLocale: 'en-GB',
        rateLimits: {} as any,
      };
      
      expect(() => validateEmailConfig(config)).toThrow('Invalid Postmark from email format');
    });
  });
});
