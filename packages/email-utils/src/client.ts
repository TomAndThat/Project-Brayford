/**
 * Postmark Client Wrapper
 * 
 * Handles email sending via Postmark API with dev mode support,
 * template validation, and error handling.
 */

import { ServerClient } from 'postmark';
import type { SendEmailOptions, EmailResult, EmailId } from './types';
import { validateSendEmailOptions } from './schemas';
import { validateTemplateData } from './templates/registry';
import { isDevMode, logEmailToConsole, createMockEmailResult } from './utils/dev-mode';
import { normalizeEmail } from './utils/validation';
import { emailConfig } from './config';

/**
 * Postmark client instance (lazy initialization)
 */
let postmarkClient: ServerClient | null = null;

/**
 * Get or create Postmark client
 */
function getPostmarkClient(): ServerClient {
  if (!postmarkClient) {
    if (!emailConfig.postmark.apiKey) {
      throw new Error('Postmark API key is not configured');
    }
    postmarkClient = new ServerClient(emailConfig.postmark.apiKey);
  }
  return postmarkClient;
}

/**
 * Convert metadata to string values (Postmark requirement)
 */
function convertMetadataToStrings(metadata: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    result[key] = String(value);
  }
  return result;
}

/**
 * Send an email using Postmark template
 * 
 * In dev mode, logs to console instead of sending.
 * Validates template data before sending.
 * 
 * @throws Error if validation fails or Postmark API returns an error
 */
export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  // Validate input
  validateSendEmailOptions(options);
  
  // Validate template data
  validateTemplateData(options.templateAlias, options.templateData);
  
  // Normalize email addresses
  const to = normalizeEmail(options.to);
  const from = options.from?.email 
    ? normalizeEmail(options.from.email) 
    : emailConfig.postmark.fromEmail;
  const fromName = options.from?.name || emailConfig.postmark.fromName;
  const replyTo = options.replyTo ? normalizeEmail(options.replyTo) : undefined;
  
  // Dev mode: log to console instead of sending
  if (isDevMode()) {
    logEmailToConsole({
      ...options,
      to,
      from: { email: from, name: fromName },
      replyTo,
    });
    return createMockEmailResult(options);
  }
  
  // Production mode: send via Postmark
  try {
    const client = getPostmarkClient();
    
    const response = await client.sendEmailWithTemplate({
      From: fromName ? `${fromName} <${from}>` : from,
      To: to,
      TemplateAlias: options.templateAlias,
      TemplateModel: options.templateData,
      ReplyTo: replyTo,
      MessageStream: 'outbound',
      // Convert metadata to string values for Postmark
      Metadata: options.metadata ? convertMetadataToStrings(options.metadata) : undefined,
    });
    
    return {
      emailId: response.MessageID as EmailId,
      messageId: response.MessageID,
      sentAt: new Date(),
      to,
      type: options.type,
      devMode: false,
    };
  } catch (error) {
    // Enhance error message
    if (error instanceof Error) {
      throw new EmailSendError(
        `Failed to send email via Postmark: ${error.message}`,
        options.type,
        to,
        error
      );
    }
    throw error;
  }
}

/**
 * Email send error with additional context
 */
export class EmailSendError extends Error {
  constructor(
    message: string,
    public readonly emailType: string,
    public readonly recipient: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'EmailSendError';
  }
}

/**
 * Batch send emails (sequentially for Phase 1)
 * Phase 2 will implement proper queuing with Cloud Tasks
 * 
 * @param emails - Array of email options to send
 * @returns Array of results (successful sends only throw on first error)
 */
export async function sendEmailBatch(
  emails: SendEmailOptions[]
): Promise<EmailResult[]> {
  const results: EmailResult[] = [];
  
  for (const email of emails) {
    const result = await sendEmail(email);
    results.push(result);
  }
  
  return results;
}

/**
 * Test Postmark connection
 * Useful for verifying configuration
 */
export async function testPostmarkConnection(): Promise<boolean> {
  if (isDevMode()) {
    console.log('✓ Email is in dev mode - Postmark connection not tested');
    return true;
  }
  
  try {
    const client = getPostmarkClient();
    // Attempt to get server info (doesn't send email)
    await client.getServer();
    console.log('✓ Postmark connection successful');
    return true;
  } catch (error) {
    console.error('✗ Postmark connection failed:', error);
    return false;
  }
}
