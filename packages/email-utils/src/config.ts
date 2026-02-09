/**
 * Email Configuration
 * 
 * Loads and validates email configuration from environment variables
 */

import type { EmailConfig } from './types';

/**
 * Load email configuration from environment variables
 */
export function getEmailConfig(): EmailConfig {
  const devMode = process.env.EMAIL_DEV_MODE === 'true';
  
  // In dev mode, API key is optional
  const apiKey = process.env.POSTMARK_API_KEY || '';
  if (!devMode && !apiKey) {
    throw new Error(
      'POSTMARK_API_KEY environment variable is required when EMAIL_DEV_MODE is not enabled'
    );
  }
  
  return {
    postmark: {
      apiKey,
      fromEmail: process.env.POSTMARK_FROM_EMAIL || 'noreply@brayford.app',
      fromName: process.env.POSTMARK_FROM_NAME || 'Brayford Platform',
    },
    devMode,
    defaultLocale: 'en-GB',
    rateLimits: {
      'invitation': parseInt(process.env.EMAIL_RATE_LIMIT_INVITATION || '10'),
      'password-reset': parseInt(process.env.EMAIL_RATE_LIMIT_PASSWORD_RESET || '5'),
      'verification': parseInt(process.env.EMAIL_RATE_LIMIT_VERIFICATION || '5'),
      'event-reminder': 100,
      'weekly-digest': 100,
      'marketing': 100,
      'billing-invoice': 20,
    },
  };
}

/**
 * Validate email configuration
 */
export function validateEmailConfig(config: EmailConfig): void {
  if (!config.devMode && !config.postmark.apiKey) {
    throw new Error('Postmark API key is required in production mode');
  }
  
  if (!config.postmark.fromEmail) {
    throw new Error('Postmark from email is required');
  }
  
  // Validate email format (basic check)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(config.postmark.fromEmail)) {
    throw new Error('Invalid Postmark from email format');
  }
}

// Export singleton config instance
export const emailConfig = getEmailConfig();
validateEmailConfig(emailConfig);
