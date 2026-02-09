/**
 * Dev Mode Utilities Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isDevMode, logEmailToConsole, createMockEmailResult } from '../utils/dev-mode';
import type { SendEmailOptions } from '../types';

describe('Dev Mode Utilities', () => {
  const originalEnv = process.env.EMAIL_DEV_MODE;
  
  afterEach(() => {
    process.env.EMAIL_DEV_MODE = originalEnv;
  });
  
  describe('isDevMode', () => {
    it('returns true when EMAIL_DEV_MODE is "true"', () => {
      process.env.EMAIL_DEV_MODE = 'true';
      expect(isDevMode()).toBe(true);
    });
    
    it('returns false when EMAIL_DEV_MODE is "false"', () => {
      process.env.EMAIL_DEV_MODE = 'false';
      expect(isDevMode()).toBe(false);
    });
    
    it('returns false when EMAIL_DEV_MODE is undefined', () => {
      delete process.env.EMAIL_DEV_MODE;
      expect(isDevMode()).toBe(false);
    });
    
    it('returns false for other values', () => {
      process.env.EMAIL_DEV_MODE = 'yes';
      expect(isDevMode()).toBe(false);
      
      process.env.EMAIL_DEV_MODE = '1';
      expect(isDevMode()).toBe(false);
    });
  });
  
  describe('logEmailToConsole', () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    
    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });
    
    afterEach(() => {
      consoleLogSpy.mockRestore();
    });
    
    it('logs email details to console', () => {
      const options: SendEmailOptions = {
        type: 'invitation',
        to: 'user@example.com',
        templateAlias: 'organization-invitation',
        templateData: {
          organizationName: 'Acme Corp',
          inviterName: 'Sarah',
        },
      };
      
      logEmailToConsole(options);
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const logs = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      
      expect(logs).toContain('EMAIL (DEV MODE - NOT SENT)');
      expect(logs).toContain('Type: invitation');
      expect(logs).toContain('To: user@example.com');
      expect(logs).toContain('Template: organization-invitation');
      expect(logs).toContain('Acme Corp');
      expect(logs).toContain('Sarah');
    });
    
    it('logs from field when provided', () => {
      const options: SendEmailOptions = {
        type: 'invitation',
        to: 'user@example.com',
        templateAlias: 'test',
        templateData: {},
        from: { email: 'sender@example.com', name: 'Sender Name' },
      };
      
      logEmailToConsole(options);
      
      const logs = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(logs).toContain('From:');
      expect(logs).toContain('sender@example.com');
    });
    
    it('logs replyTo field when provided', () => {
      const options: SendEmailOptions = {
        type: 'invitation',
        to: 'user@example.com',
        templateAlias: 'test',
        templateData: {},
        replyTo: 'reply@example.com',
      };
      
      logEmailToConsole(options);
      
      const logs = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(logs).toContain('Reply-To:');
      expect(logs).toContain('reply@example.com');
    });
    
    it('logs metadata when provided', () => {
      const options: SendEmailOptions = {
        type: 'invitation',
        to: 'user@example.com',
        templateAlias: 'test',
        templateData: {},
        metadata: {
          organizationId: 'org-123',
          userId: 'user-456',
        },
      };
      
      logEmailToConsole(options);
      
      const logs = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(logs).toContain('Metadata:');
      expect(logs).toContain('org-123');
      expect(logs).toContain('user-456');
    });
  });
  
  describe('createMockEmailResult', () => {
    it('creates a mock email result', () => {
      const options: SendEmailOptions = {
        type: 'invitation',
        to: 'user@example.com',
        templateAlias: 'test',
        templateData: {},
      };
      
      const result = createMockEmailResult(options);
      
      expect(result).toHaveProperty('emailId');
      expect(result).toHaveProperty('messageId');
      expect(result).toHaveProperty('sentAt');
      expect(result.to).toBe('user@example.com');
      expect(result.type).toBe('invitation');
      expect(result.devMode).toBe(true);
    });
    
    it('generates unique email IDs', async () => {
      const options: SendEmailOptions = {
        type: 'invitation',
        to: 'user@example.com',
        templateAlias: 'test',
        templateData: {},
      };
      
      const result1 = createMockEmailResult(options);
      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      const result2 = createMockEmailResult(options);
      
      expect(result1.emailId).not.toBe(result2.emailId);
      expect(result1.messageId).not.toBe(result2.messageId);
    });
    
    it('sets sentAt to current time', () => {
      const before = new Date();
      
      const options: SendEmailOptions = {
        type: 'invitation',
        to: 'user@example.com',
        templateAlias: 'test',
        templateData: {},
      };
      
      const result = createMockEmailResult(options);
      const after = new Date();
      
      expect(result.sentAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.sentAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
});
