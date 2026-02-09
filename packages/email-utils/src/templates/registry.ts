/**
 * Email Template Registry
 * 
 * Central registry of all email templates with validation rules.
 * Templates are managed in the Postmark dashboard - this provides type safety.
 */

import type { TemplateDefinition } from './index';

/**
 * Email template registry
 * 
 * Each template definition includes:
 * - alias: Postmark template alias
 * - displayName: Human-readable name (UK English)
 * - description: What the email is for
 * - requiredData: Array of required template variable names
 * - locale: UK English only for MVP
 */
export const TEMPLATES: Record<string, TemplateDefinition> = {
  'organization-invitation': {
    alias: 'organization-invitation',
    displayName: 'Organisation Invitation',
    description: 'Invite user to join an organisation',
    requiredData: ['organizationName', 'inviterName', 'inviteLink'],
    locale: 'en-GB',
  },
  
  'password-reset': {
    alias: 'password-reset',
    displayName: 'Password Reset',
    description: 'Password reset link for user',
    requiredData: ['resetLink', 'expiresIn'],
    locale: 'en-GB',
  },
  
  'email-verification': {
    alias: 'email-verification',
    displayName: 'Email Verification',
    description: 'Verify email address for new user',
    requiredData: ['verificationLink', 'expiresIn'],
    locale: 'en-GB',
  },
  
  'event-reminder': {
    alias: 'event-reminder',
    displayName: 'Event Reminder',
    description: 'Reminder before live event starts',
    requiredData: ['eventName', 'eventDate', 'eventTime', 'eventLink', 'brandName'],
    locale: 'en-GB',
  },
  
  'weekly-digest': {
    alias: 'weekly-digest',
    displayName: 'Weekly Digest',
    description: 'Weekly summary for creator',
    requiredData: ['userName', 'weekStart', 'weekEnd', 'eventCount', 'participantCount', 'dashboardLink'],
    locale: 'en-GB',
  },
  
  'billing-invoice': {
    alias: 'billing-invoice',
    displayName: 'Billing Invoice',
    description: 'Payment receipt and invoice',
    requiredData: ['invoiceNumber', 'invoiceDate', 'amount', 'currency', 'invoiceLink'],
    locale: 'en-GB',
  },
};

/**
 * Get template definition by alias
 * 
 * @throws Error if template not found
 */
export function getTemplate(alias: string): TemplateDefinition {
  const template = TEMPLATES[alias];
  if (!template) {
    throw new Error(`Unknown email template: ${alias}`);
  }
  return template;
}

/**
 * Validate that template data contains all required fields
 * 
 * @throws Error if required fields are missing
 */
export function validateTemplateData(
  alias: string,
  data: Record<string, unknown>
): void {
  const template = getTemplate(alias);
  
  const missing = template.requiredData.filter(key => !(key in data));
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required template data for '${alias}': ${missing.join(', ')}`
    );
  }
}

/**
 * Get all registered template aliases
 */
export function getAllTemplateAliases(): string[] {
  return Object.keys(TEMPLATES);
}

/**
 * Check if a template alias is registered
 */
export function isTemplateRegistered(alias: string): boolean {
  return alias in TEMPLATES;
}
