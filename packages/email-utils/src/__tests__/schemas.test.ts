/**
 * Schema Validation Tests
 */

import { describe, it, expect } from 'vitest';
import {
  EmailTypeSchema,
  EmailSenderSchema,
  SendEmailOptionsSchema,
  RateLimitOptionsSchema,
  validateSendEmailOptions,
  validateRateLimitOptions,
} from '../schemas';

describe('Schemas', () => {
  describe('EmailTypeSchema', () => {
    it('validates valid email types', () => {
      expect(() => EmailTypeSchema.parse('invitation')).not.toThrow();
      expect(() => EmailTypeSchema.parse('password-reset')).not.toThrow();
      expect(() => EmailTypeSchema.parse('verification')).not.toThrow();
      expect(() => EmailTypeSchema.parse('event-reminder')).not.toThrow();
      expect(() => EmailTypeSchema.parse('weekly-digest')).not.toThrow();
      expect(() => EmailTypeSchema.parse('marketing')).not.toThrow();
      expect(() => EmailTypeSchema.parse('billing-invoice')).not.toThrow();
    });
    
    it('rejects invalid email types', () => {
      expect(() => EmailTypeSchema.parse('invalid-type')).toThrow();
      expect(() => EmailTypeSchema.parse('')).toThrow();
      expect(() => EmailTypeSchema.parse(123)).toThrow();
    });
  });
  
  describe('EmailSenderSchema', () => {
    it('validates valid sender with email only', () => {
      const sender = { email: 'test@example.com' };
      expect(() => EmailSenderSchema.parse(sender)).not.toThrow();
    });
    
    it('validates valid sender with email and name', () => {
      const sender = { email: 'test@example.com', name: 'Test User' };
      const result = EmailSenderSchema.parse(sender);
      expect(result.email).toBe('test@example.com');
      expect(result.name).toBe('Test User');
    });
    
    it('rejects invalid email addresses', () => {
      expect(() => EmailSenderSchema.parse({ email: 'not-an-email' })).toThrow();
      expect(() => EmailSenderSchema.parse({ email: '@example.com' })).toThrow();
      expect(() => EmailSenderSchema.parse({ email: 'test@' })).toThrow();
    });
    
    it('requires email field', () => {
      expect(() => EmailSenderSchema.parse({ name: 'Test User' })).toThrow();
      expect(() => EmailSenderSchema.parse({})).toThrow();
    });
  });
  
  describe('SendEmailOptionsSchema', () => {
    it('validates complete email options', () => {
      const options = {
        type: 'invitation',
        to: 'user@example.com',
        templateAlias: 'organization-invitation',
        templateData: { name: 'Test' },
      };
      
      expect(() => SendEmailOptionsSchema.parse(options)).not.toThrow();
    });
    
    it('validates email options with optional fields', () => {
      const options = {
        type: 'invitation',
        to: 'user@example.com',
        templateAlias: 'organization-invitation',
        templateData: { name: 'Test' },
        from: { email: 'sender@example.com', name: 'Sender' },
        replyTo: 'reply@example.com',
        metadata: { orgId: '123' },
        locale: 'en-GB',
      };
      
      const result = SendEmailOptionsSchema.parse(options);
      expect(result.from?.email).toBe('sender@example.com');
      expect(result.replyTo).toBe('reply@example.com');
      expect(result.metadata).toEqual({ orgId: '123' });
      expect(result.locale).toBe('en-GB');
    });
    
    it('rejects invalid type', () => {
      const options = {
        type: 'invalid',
        to: 'user@example.com',
        templateAlias: 'test',
        templateData: {},
      };
      
      expect(() => SendEmailOptionsSchema.parse(options)).toThrow();
    });
    
    it('rejects invalid recipient email', () => {
      const options = {
        type: 'invitation',
        to: 'not-an-email',
        templateAlias: 'test',
        templateData: {},
      };
      
      expect(() => SendEmailOptionsSchema.parse(options)).toThrow('Invalid recipient email');
    });
    
    it('rejects empty template alias', () => {
      const options = {
        type: 'invitation',
        to: 'user@example.com',
        templateAlias: '',
        templateData: {},
      };
      
      expect(() => SendEmailOptionsSchema.parse(options)).toThrow();
    });
    
    it('rejects invalid reply-to email', () => {
      const options = {
        type: 'invitation',
        to: 'user@example.com',
        templateAlias: 'test',
        templateData: {},
        replyTo: 'not-an-email',
      };
      
      expect(() => SendEmailOptionsSchema.parse(options)).toThrow('Invalid reply-to email');
    });
  });
  
  describe('RateLimitOptionsSchema', () => {
    it('validates valid rate limit options', () => {
      const options = {
        type: 'invitation',
        scopeId: 'org-123',
      };
      
      expect(() => RateLimitOptionsSchema.parse(options)).not.toThrow();
    });
    
    it('rejects invalid type', () => {
      const options = {
        type: 'invalid',
        scopeId: 'org-123',
      };
      
      expect(() => RateLimitOptionsSchema.parse(options)).toThrow();
    });
    
    it('rejects empty scopeId', () => {
      const options = {
        type: 'invitation',
        scopeId: '',
      };
      
      expect(() => RateLimitOptionsSchema.parse(options)).toThrow('Scope ID is required');
    });
    
    it('requires both fields', () => {
      expect(() => RateLimitOptionsSchema.parse({ type: 'invitation' })).toThrow();
      expect(() => RateLimitOptionsSchema.parse({ scopeId: 'org-123' })).toThrow();
    });
  });
  
  describe('validateSendEmailOptions', () => {
    it('validates and returns parsed options', () => {
      const options = {
        type: 'invitation',
        to: 'user@example.com',
        templateAlias: 'organization-invitation',
        templateData: { name: 'Test' },
      };
      
      const result = validateSendEmailOptions(options);
      expect(result.type).toBe('invitation');
      expect(result.to).toBe('user@example.com');
    });
    
    it('throws on invalid data', () => {
      expect(() => validateSendEmailOptions({})).toThrow();
      expect(() => validateSendEmailOptions({ type: 'invalid' })).toThrow();
    });
  });
  
  describe('validateRateLimitOptions', () => {
    it('validates and returns parsed options', () => {
      const options = {
        type: 'invitation',
        scopeId: 'org-123',
      };
      
      const result = validateRateLimitOptions(options);
      expect(result.type).toBe('invitation');
      expect(result.scopeId).toBe('org-123');
    });
    
    it('throws on invalid data', () => {
      expect(() => validateRateLimitOptions({})).toThrow();
      expect(() => validateRateLimitOptions({ type: 'invitation' })).toThrow();
    });
  });
});
