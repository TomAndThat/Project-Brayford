/**
 * Development Mode Utilities
 * 
 * Provides console logging for emails during development instead of actually sending them.
 */

import type { SendEmailOptions, EmailResult, EmailId } from '../types';

/**
 * Log email to console in dev mode
 * Provides formatted output showing all email details
 */
export function logEmailToConsole(options: SendEmailOptions): void {
  const { type, to, templateAlias, templateData, from, replyTo, metadata } = options;
  
  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│ 📧 EMAIL (DEV MODE - NOT SENT)                              │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│ Type: ${type.padEnd(52)} │`);
  console.log(`│ To: ${to.padEnd(54)} │`);
  console.log(`│ Template: ${templateAlias.padEnd(48)} │`);
  
  if (from) {
    const fromStr = from.name ? `${from.name} <${from.email}>` : from.email;
    console.log(`│ From: ${fromStr.padEnd(52)} │`);
  }
  
  if (replyTo) {
    console.log(`│ Reply-To: ${replyTo.padEnd(48)} │`);
  }
  
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│ Template Data:                                              │');
  
  const dataStr = JSON.stringify(templateData, null, 2);
  const dataLines = dataStr.split('\n');
  dataLines.forEach(line => {
    const truncated = line.length > 57 ? line.substring(0, 54) + '...' : line;
    console.log(`│ ${truncated.padEnd(58)} │`);
  });
  
  if (metadata && Object.keys(metadata).length > 0) {
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log('│ Metadata:                                                   │');
    const metaStr = JSON.stringify(metadata, null, 2);
    const metaLines = metaStr.split('\n');
    metaLines.forEach(line => {
      const truncated = line.length > 57 ? line.substring(0, 54) + '...' : line;
      console.log(`│ ${truncated.padEnd(58)} │`);
    });
  }
  
  console.log('└─────────────────────────────────────────────────────────────┘');
  
  // Extract and log URLs from template data
  const urls = extractUrls(templateData);
  if (urls.length > 0) {
    console.log('\n🔗 Clickable Links:');
    urls.forEach(({ key, url }) => {
      console.log(`   ${key}: ${url}`);
    });
    console.log('');
  } else {
    console.log('');
  }
}

/**
 * Extract URLs from template data
 * Looks for properties ending with 'Url', 'url', 'Link', or 'link'
 */
function extractUrls(data: Record<string, unknown>): Array<{ key: string; url: string }> {
  const urls: Array<{ key: string; url: string }> = [];
  
  for (const [key, value] of Object.entries(data)) {
    // Check if the key suggests it's a URL
    if (
      typeof value === 'string' &&
      (key.endsWith('Url') || key.endsWith('url') || 
       key.endsWith('Link') || key.endsWith('link') ||
       key.toLowerCase().includes('url') || key.toLowerCase().includes('link'))
    ) {
      // Verify it's actually a URL
      if (value.startsWith('http://') || value.startsWith('https://')) {
        urls.push({ key, url: value });
      }
    }
  }
  
  return urls;
}

/**
 * Create a mock email result for dev mode
 */
export function createMockEmailResult(
  options: SendEmailOptions
): EmailResult {
  return {
    emailId: `dev-${Date.now()}-${Math.random().toString(36).substring(7)}` as EmailId,
    messageId: `mock-${Date.now()}`,
    sentAt: new Date(),
    to: options.to,
    type: options.type,
    devMode: true,
  };
}

/**
 * Check if dev mode is enabled
 */
export function isDevMode(): boolean {
  return process.env.EMAIL_DEV_MODE === 'true';
}
