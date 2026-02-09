/**
 * Template Registry Tests
 */

import { describe, it, expect } from 'vitest';
import {
  TEMPLATES,
  getTemplate,
  validateTemplateData,
  getAllTemplateAliases,
  isTemplateRegistered,
} from '../templates/registry';

describe('Template Registry', () => {
  describe('TEMPLATES', () => {
    it('contains expected templates', () => {
      expect(TEMPLATES).toHaveProperty('organization-invitation');
      expect(TEMPLATES).toHaveProperty('password-reset');
      expect(TEMPLATES).toHaveProperty('email-verification');
      expect(TEMPLATES).toHaveProperty('event-reminder');
      expect(TEMPLATES).toHaveProperty('weekly-digest');
      expect(TEMPLATES).toHaveProperty('billing-invoice');
    });
    
    it('all templates have required fields', () => {
      Object.values(TEMPLATES).forEach(template => {
        expect(template).toHaveProperty('alias');
        expect(template).toHaveProperty('displayName');
        expect(template).toHaveProperty('description');
        expect(template).toHaveProperty('requiredData');
        expect(template).toHaveProperty('locale');
        expect(template.locale).toBe('en-GB');
      });
    });
    
    it('templates use UK English in display names', () => {
      const invitationTemplate = TEMPLATES['organization-invitation'];
      expect(invitationTemplate?.displayName).toContain('Organisation'); // UK spelling
    });
  });
  
  describe('getTemplate', () => {
    it('returns template definition for valid alias', () => {
      const template = getTemplate('organization-invitation');
      
      expect(template.alias).toBe('organization-invitation');
      expect(template.displayName).toBe('Organisation Invitation');
      expect(template.requiredData).toEqual([
        'organizationName',
        'inviterName',
        'inviteLink',
        'role',
        'expiresAt',
      ]);
    });
    
    it('throws error for unknown alias', () => {
      expect(() => {
        getTemplate('unknown-template');
      }).toThrow('Unknown email template: unknown-template');
    });
  });
  
  describe('validateTemplateData', () => {
    it('validates data with all required fields', () => {
      expect(() => {
        validateTemplateData('organization-invitation', {
          organizationName: 'Acme Corp',
          inviterName: 'Sarah',
          inviteLink: 'https://example.com/join/abc',
          role: 'member',
          expiresAt: '8 June 2024',
        });
      }).not.toThrow();
    });
    
    it('validates data with extra fields', () => {
      expect(() => {
        validateTemplateData('organization-invitation', {
          organizationName: 'Acme Corp',
          inviterName: 'Sarah',
          inviteLink: 'https://example.com/join/abc',
          role: 'admin',
          expiresAt: '8 June 2024',
          extraField: 'ignored',
        });
      }).not.toThrow();
    });
    
    it('throws error when required field is missing', () => {
      expect(() => {
        validateTemplateData('organization-invitation', {
          organizationName: 'Acme Corp',
          inviterName: 'Sarah',
          role: 'member',
          expiresAt: '8 June 2024',
          // Missing inviteLink
        });
      }).toThrow('Missing required template data');
      
      expect(() => {
        validateTemplateData('organization-invitation', {
          organizationName: 'Acme Corp',
          inviterName: 'Sarah',
          role: 'member',
          expiresAt: '8 June 2024',
        });
      }).toThrow('inviteLink');
    });
    
    it('throws error when multiple required fields are missing', () => {
      expect(() => {
        validateTemplateData('organization-invitation', {
          organizationName: 'Acme Corp',
          // Missing inviterName and inviteLink
        });
      }).toThrow('inviterName');
      
      expect(() => {
        validateTemplateData('organization-invitation', {
          organizationName: 'Acme Corp',
        });
      }).toThrow('inviteLink');
    });
    
    it('validates password-reset template', () => {
      expect(() => {
        validateTemplateData('password-reset', {
          resetLink: 'https://example.com/reset/token',
          expiresIn: '1 hour',
        });
      }).not.toThrow();
      
      expect(() => {
        validateTemplateData('password-reset', {
          resetLink: 'https://example.com/reset/token',
          // Missing expiresIn
        });
      }).toThrow('expiresIn');
    });
    
    it('validates event-reminder template', () => {
      expect(() => {
        validateTemplateData('event-reminder', {
          eventName: 'Live Podcast',
          eventDate: '2026-03-15',
          eventTime: '19:00 GMT',
          eventLink: 'https://example.com/event/123',
          brandName: 'My Podcast',
        });
      }).not.toThrow();
    });
  });
  
  describe('getAllTemplateAliases', () => {
    it('returns array of all template aliases', () => {
      const aliases = getAllTemplateAliases();
      
      expect(Array.isArray(aliases)).toBe(true);
      expect(aliases).toContain('organization-invitation');
      expect(aliases).toContain('password-reset');
      expect(aliases).toContain('email-verification');
      expect(aliases.length).toBeGreaterThan(0);
    });
  });
  
  describe('isTemplateRegistered', () => {
    it('returns true for registered templates', () => {
      expect(isTemplateRegistered('organization-invitation')).toBe(true);
      expect(isTemplateRegistered('password-reset')).toBe(true);
      expect(isTemplateRegistered('billing-invoice')).toBe(true);
    });
    
    it('returns false for unregistered templates', () => {
      expect(isTemplateRegistered('unknown-template')).toBe(false);
      expect(isTemplateRegistered('')).toBe(false);
      expect(isTemplateRegistered('not-a-template')).toBe(false);
    });
  });
});
