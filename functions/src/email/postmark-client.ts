/**
 * Postmark Client
 *
 * Handles email sending via Postmark API with template support.
 * In dev mode, logs to console instead of sending.
 */

import { ServerClient } from 'postmark';
import * as logger from 'firebase-functions/logger';
import type { EmailQueueDocument, EmailQueueId } from '@brayford/core';
import { getEmailConfig, isDevMode } from './config';
import { logEmailToConsole, createMockEmailResult } from './dev-mode';

// ===== Types =====

/**
 * Result of sending an email
 */
export interface SendResult {
  success: boolean;
  messageId?: string;
  sentAt?: Date;
  error?: {
    code: string;
    message: string;
  };
}

// ===== Postmark Client =====

/**
 * Lazy-initialised Postmark client instance
 */
let postmarkClient: ServerClient | null = null;

/**
 * Get or create Postmark client
 */
function getPostmarkClient(): ServerClient {
  if (!postmarkClient) {
    const config = getEmailConfig();
    
    if (!config.postmark.apiKey) {
      throw new Error('Postmark API key is not configured');
    }
    
    postmarkClient = new ServerClient(config.postmark.apiKey);
  }
  
  return postmarkClient;
}

/**
 * Convert metadata to string values (Postmark requirement)
 */
function convertMetadataToStrings(
  metadata: Record<string, unknown>
): Record<string, string> {
  const result: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(metadata)) {
    if (value !== undefined && value !== null) {
      result[key] = String(value);
    }
  }
  
  return result;
}

/**
 * Normalise email address (lowercase, trim)
 */
function normaliseEmail(email: string): string {
  return email.toLowerCase().trim();
}

// ===== Send Functions =====

/**
 * Send an email via Postmark
 *
 * In dev mode, logs to console instead of sending.
 *
 * @param emailId - Email queue document ID
 * @param email - Email queue document
 * @returns Send result
 */
export async function sendEmail(
  emailId: EmailQueueId,
  email: EmailQueueDocument
): Promise<SendResult> {
  // Dev mode: log to console
  if (isDevMode()) {
    logEmailToConsole(emailId, email);
    const mockResult = createMockEmailResult(emailId);
    
    return {
      success: true,
      messageId: mockResult.messageId,
      sentAt: mockResult.sentAt,
    };
  }

  // Production mode: send via Postmark
  try {
    const config = getEmailConfig();
    const client = getPostmarkClient();

    // Build sender string
    const fromEmail = email.from?.email || config.postmark.fromEmail;
    const fromName = email.from?.name || config.postmark.fromName;
    const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

    // Send email with template
    const response = await client.sendEmailWithTemplate({
      From: from,
      To: normaliseEmail(email.to),
      TemplateAlias: email.templateAlias,
      TemplateModel: email.templateData,
      ReplyTo: email.replyTo ? normaliseEmail(email.replyTo) : undefined,
      MessageStream: 'outbound',
      Metadata: convertMetadataToStrings(email.metadata),
    });

    logger.info('Email sent successfully', {
      emailId,
      messageId: response.MessageID,
      to: email.to,
      template: email.templateAlias,
    });

    return {
      success: true,
      messageId: response.MessageID,
      sentAt: new Date(),
    };
  } catch (error) {
    // Handle errors (Postmark errors have code and message properties)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = (error as { code?: number | string })?.code?.toString() || 'UNKNOWN';
    
    logger.error('Email send failed', {
      emailId,
      to: email.to,
      template: email.templateAlias,
      errorCode,
      errorMessage,
    });

    return {
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
      },
    };
  }
}

/**
 * Test Postmark connection
 *
 * Useful for verifying API key is valid during deployment.
 */
export async function testPostmarkConnection(): Promise<boolean> {
  if (isDevMode()) {
    logger.info('Postmark connection test skipped (dev mode)');
    return true;
  }

  try {
    const client = getPostmarkClient();
    await client.getServer();
    logger.info('Postmark connection test successful');
    return true;
  } catch (error) {
    logger.error('Postmark connection test failed', { error });
    return false;
  }
}
