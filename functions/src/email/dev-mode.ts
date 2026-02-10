/**
 * Development Mode Utilities
 *
 * In dev mode (EMAIL_DEV_MODE=true), emails are logged to the console
 * instead of being sent via Postmark. This allows local development
 * without consuming email credits or spamming test inboxes.
 */

import * as logger from 'firebase-functions/logger';
import type { EmailQueueDocument, EmailQueueId } from '@brayford/core';

/**
 * Log email details to console (dev mode)
 */
export function logEmailToConsole(emailId: EmailQueueId, email: EmailQueueDocument): void {
  const separator = '─'.repeat(60);
  
  logger.info(`
${separator}
📧 [DEV MODE] Email queued but not sent
${separator}
   ID:       ${emailId}
   To:       ${email.to}
   Type:     ${email.type}
   Mode:     ${email.deliveryMode}
   Template: ${email.templateAlias}
   Data:     ${JSON.stringify(email.templateData, null, 2).split('\n').join('\n           ')}
   Metadata: ${JSON.stringify(email.metadata, null, 2).split('\n').join('\n           ')}
${separator}
`);
}

/**
 * Create a mock email result for dev mode
 */
export function createMockEmailResult(emailId: EmailQueueId): {
  messageId: string;
  sentAt: Date;
} {
  return {
    messageId: `dev-mode-${emailId}-${Date.now()}`,
    sentAt: new Date(),
  };
}

/**
 * Log batch processing summary (dev mode)
 */
export function logBatchSummary(
  processed: number,
  sent: number,
  failed: number,
  rateLimited: number
): void {
  logger.info(`
📧 [DEV MODE] Batch processing complete
   Processed:    ${processed}
   Sent:         ${sent}
   Failed:       ${failed}
   Rate Limited: ${rateLimited}
`);
}
