import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  EmailTypeSchema,
  DeliveryModeSchema,
  EmailQueueStatusSchema,
  EmailSenderSchema,
  EmailMetadataSchema,
  EmailErrorSchema,
  EmailQueueDocumentSchema,
  CreateEmailQueueSchema,
  validateEmailQueueDocument,
  validateCreateEmailQueueData,
  safeValidateCreateEmailQueueData,
  getRateLimitScope,
  getDefaultDeliveryMode,
  isTransactionalEmail,
  isBulkEmail,
  createMockEmailQueueDocument,
  EMAIL_RATE_LIMITS,
} from '../email-queue.schema';

// ===== EmailTypeSchema =====

describe('EmailTypeSchema', () => {
  it('accepts valid email types', () => {
    expect(EmailTypeSchema.parse('invitation')).toBe('invitation');
    expect(EmailTypeSchema.parse('password-reset')).toBe('password-reset');
    expect(EmailTypeSchema.parse('verification')).toBe('verification');
    expect(EmailTypeSchema.parse('event-reminder')).toBe('event-reminder');
    expect(EmailTypeSchema.parse('weekly-digest')).toBe('weekly-digest');
    expect(EmailTypeSchema.parse('marketing')).toBe('marketing');
    expect(EmailTypeSchema.parse('billing-invoice')).toBe('billing-invoice');
    expect(EmailTypeSchema.parse('organization-deletion')).toBe('organization-deletion');
  });

  it('rejects invalid email types', () => {
    expect(() => EmailTypeSchema.parse('welcome')).toThrow(ZodError);
    expect(() => EmailTypeSchema.parse('')).toThrow(ZodError);
    expect(() => EmailTypeSchema.parse('INVITATION')).toThrow(ZodError);
  });
});

// ===== DeliveryModeSchema =====

describe('DeliveryModeSchema', () => {
  it('accepts valid delivery modes', () => {
    expect(DeliveryModeSchema.parse('immediate')).toBe('immediate');
    expect(DeliveryModeSchema.parse('batch')).toBe('batch');
  });

  it('rejects invalid delivery modes', () => {
    expect(() => DeliveryModeSchema.parse('scheduled')).toThrow(ZodError);
    expect(() => DeliveryModeSchema.parse('')).toThrow(ZodError);
  });
});

// ===== EmailQueueStatusSchema =====

describe('EmailQueueStatusSchema', () => {
  it('accepts valid statuses', () => {
    expect(EmailQueueStatusSchema.parse('pending')).toBe('pending');
    expect(EmailQueueStatusSchema.parse('processing')).toBe('processing');
    expect(EmailQueueStatusSchema.parse('sent')).toBe('sent');
    expect(EmailQueueStatusSchema.parse('failed')).toBe('failed');
    expect(EmailQueueStatusSchema.parse('rate-limited')).toBe('rate-limited');
  });

  it('rejects invalid statuses', () => {
    expect(() => EmailQueueStatusSchema.parse('queued')).toThrow(ZodError);
    expect(() => EmailQueueStatusSchema.parse('')).toThrow(ZodError);
  });
});

// ===== EmailSenderSchema =====

describe('EmailSenderSchema', () => {
  it('validates a complete sender', () => {
    const sender = {
      email: 'sender@example.com',
      name: 'Test Sender',
    };
    const result = EmailSenderSchema.parse(sender);
    expect(result.email).toBe('sender@example.com');
    expect(result.name).toBe('Test Sender');
  });

  it('allows sender without name', () => {
    const sender = { email: 'sender@example.com' };
    const result = EmailSenderSchema.parse(sender);
    expect(result.email).toBe('sender@example.com');
    expect(result.name).toBeUndefined();
  });

  it('rejects invalid email', () => {
    expect(() => EmailSenderSchema.parse({ email: 'invalid' })).toThrow(ZodError);
    expect(() => EmailSenderSchema.parse({ email: '' })).toThrow(ZodError);
  });
});

// ===== EmailMetadataSchema =====

describe('EmailMetadataSchema', () => {
  it('validates complete metadata', () => {
    const metadata = {
      userId: 'user-123',
      organizationId: 'org-456',
      eventId: 'event-789',
      brandId: 'brand-012',
      campaignId: 'campaign-345',
    };
    const result = EmailMetadataSchema.parse(metadata);
    expect(result.userId).toBe('user-123');
    expect(result.organizationId).toBe('org-456');
  });

  it('allows empty metadata', () => {
    const result = EmailMetadataSchema.parse({});
    expect(result).toEqual({});
  });

  it('allows additional fields (passthrough)', () => {
    const metadata = {
      userId: 'user-123',
      customField: 'custom-value',
    };
    const result = EmailMetadataSchema.parse(metadata);
    expect(result.customField).toBe('custom-value');
  });
});

// ===== EmailErrorSchema =====

describe('EmailErrorSchema', () => {
  it('validates a complete error', () => {
    const error = {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests',
      timestamp: new Date('2026-02-10T10:00:00Z'),
    };
    const result = EmailErrorSchema.parse(error);
    expect(result.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(result.message).toBe('Too many requests');
  });

  it('rejects incomplete error', () => {
    expect(() => EmailErrorSchema.parse({ code: 'ERROR' })).toThrow(ZodError);
    expect(() => EmailErrorSchema.parse({ message: 'Error' })).toThrow(ZodError);
  });
});

// ===== EmailQueueDocumentSchema =====

describe('EmailQueueDocumentSchema', () => {
  it('validates a complete email queue document', () => {
    const doc = createMockEmailQueueDocument();
    const result = EmailQueueDocumentSchema.parse(doc);
    expect(result.type).toBe('invitation');
    expect(result.status).toBe('pending');
    expect(result.to).toBe('test@example.com');
  });

  it('validates a document with all optional fields', () => {
    const doc = createMockEmailQueueDocument({
      from: { email: 'sender@example.com', name: 'Sender' },
      replyTo: 'reply@example.com',
      processedAt: new Date(),
      sentAt: new Date(),
      lastAttemptAt: new Date(),
      postmarkMessageId: 'pm-123',
      error: {
        code: 'ERROR',
        message: 'Failed',
        timestamp: new Date(),
      },
      rateLimitScope: 'organization:org-123',
    });
    const result = EmailQueueDocumentSchema.parse(doc);
    expect(result.from?.email).toBe('sender@example.com');
    expect(result.replyTo).toBe('reply@example.com');
    expect(result.postmarkMessageId).toBe('pm-123');
  });

  it('rejects invalid email address', () => {
    const doc = createMockEmailQueueDocument({ to: 'invalid-email' });
    expect(() => EmailQueueDocumentSchema.parse(doc)).toThrow(ZodError);
  });

  it('rejects missing required fields', () => {
    expect(() =>
      EmailQueueDocumentSchema.parse({
        type: 'invitation',
        status: 'pending',
      })
    ).toThrow(ZodError);
  });
});

// ===== CreateEmailQueueSchema =====

describe('CreateEmailQueueSchema', () => {
  it('validates create data', () => {
    const data = {
      type: 'invitation',
      deliveryMode: 'immediate',
      to: 'recipient@example.com',
      templateAlias: 'brayford-invitation-member',
      templateData: { name: 'Test' },
      metadata: { userId: 'user-123' },
    };
    const result = CreateEmailQueueSchema.parse(data);
    expect(result.type).toBe('invitation');
    expect(result.deliveryMode).toBe('immediate');
  });

  it('allows optional fields', () => {
    const data = {
      type: 'invitation',
      deliveryMode: 'immediate',
      to: 'recipient@example.com',
      templateAlias: 'brayford-invitation-member',
      templateData: {},
      metadata: {},
      from: { email: 'sender@example.com' },
      replyTo: 'reply@example.com',
      rateLimitScope: 'organization:org-123',
    };
    const result = CreateEmailQueueSchema.parse(data);
    expect(result.from?.email).toBe('sender@example.com');
  });
});

// ===== Validation Functions =====

describe('validateEmailQueueDocument', () => {
  it('returns valid document unchanged', () => {
    const doc = createMockEmailQueueDocument();
    const result = validateEmailQueueDocument(doc);
    expect(result.type).toBe(doc.type);
    expect(result.to).toBe(doc.to);
  });

  it('throws on invalid document', () => {
    expect(() => validateEmailQueueDocument({})).toThrow();
  });
});

describe('validateCreateEmailQueueData', () => {
  it('returns valid data unchanged', () => {
    const data = {
      type: 'invitation',
      deliveryMode: 'immediate',
      to: 'test@example.com',
      templateAlias: 'brayford-invitation-member',
      templateData: {},
      metadata: {},
    };
    const result = validateCreateEmailQueueData(data);
    expect(result.type).toBe('invitation');
  });
});

describe('safeValidateCreateEmailQueueData', () => {
  it('returns success for valid data', () => {
    const data = {
      type: 'invitation',
      deliveryMode: 'immediate',
      to: 'test@example.com',
      templateAlias: 'brayford-invitation-member',
      templateData: {},
      metadata: {},
    };
    const result = safeValidateCreateEmailQueueData(data);
    expect(result.success).toBe(true);
    expect(result.data?.type).toBe('invitation');
  });

  it('returns error for invalid data', () => {
    const result = safeValidateCreateEmailQueueData({});
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ===== Helper Functions =====

describe('getRateLimitScope', () => {
  it('returns user scope for password-reset', () => {
    const scope = getRateLimitScope('password-reset', { userId: 'user-123' });
    expect(scope).toBe('user:user-123');
  });

  it('returns user scope for verification', () => {
    const scope = getRateLimitScope('verification', { userId: 'user-456' });
    expect(scope).toBe('user:user-456');
  });

  it('returns organization scope for invitation', () => {
    const scope = getRateLimitScope('invitation', { organizationId: 'org-789' });
    expect(scope).toBe('organization:org-789');
  });

  it('returns organization scope for organization-deletion', () => {
    const scope = getRateLimitScope('organization-deletion', { organizationId: 'org-123' });
    expect(scope).toBe('organization:org-123');
  });

  it('returns global scope for marketing', () => {
    const scope = getRateLimitScope('marketing', {});
    expect(scope).toBe('global');
  });

  it('returns global scope for weekly-digest', () => {
    const scope = getRateLimitScope('weekly-digest', { userId: 'user-123' });
    expect(scope).toBe('global');
  });

  it('returns global when no matching metadata', () => {
    const scope = getRateLimitScope('password-reset', {});
    expect(scope).toBe('global');
  });
});

describe('getDefaultDeliveryMode', () => {
  it('returns immediate for transactional types', () => {
    expect(getDefaultDeliveryMode('invitation')).toBe('immediate');
    expect(getDefaultDeliveryMode('password-reset')).toBe('immediate');
    expect(getDefaultDeliveryMode('verification')).toBe('immediate');
    expect(getDefaultDeliveryMode('organization-deletion')).toBe('immediate');
    expect(getDefaultDeliveryMode('billing-invoice')).toBe('immediate');
  });

  it('returns batch for bulk types', () => {
    expect(getDefaultDeliveryMode('event-reminder')).toBe('batch');
    expect(getDefaultDeliveryMode('weekly-digest')).toBe('batch');
    expect(getDefaultDeliveryMode('marketing')).toBe('batch');
  });
});

describe('isTransactionalEmail', () => {
  it('returns true for transactional types', () => {
    expect(isTransactionalEmail('invitation')).toBe(true);
    expect(isTransactionalEmail('password-reset')).toBe(true);
    expect(isTransactionalEmail('verification')).toBe(true);
  });

  it('returns false for bulk types', () => {
    expect(isTransactionalEmail('marketing')).toBe(false);
    expect(isTransactionalEmail('weekly-digest')).toBe(false);
  });
});

describe('isBulkEmail', () => {
  it('returns true for bulk types', () => {
    expect(isBulkEmail('marketing')).toBe(true);
    expect(isBulkEmail('event-reminder')).toBe(true);
    expect(isBulkEmail('weekly-digest')).toBe(true);
  });

  it('returns false for transactional types', () => {
    expect(isBulkEmail('invitation')).toBe(false);
    expect(isBulkEmail('password-reset')).toBe(false);
  });
});

// ===== Rate Limits =====

describe('EMAIL_RATE_LIMITS', () => {
  it('has rate limits for all email types', () => {
    expect(EMAIL_RATE_LIMITS['invitation']).toEqual({ maxPerMinute: 10, scope: 'organization' });
    expect(EMAIL_RATE_LIMITS['password-reset']).toEqual({ maxPerMinute: 5, scope: 'user' });
    expect(EMAIL_RATE_LIMITS['verification']).toEqual({ maxPerMinute: 5, scope: 'user' });
    expect(EMAIL_RATE_LIMITS['marketing']).toEqual({ maxPerMinute: 100, scope: 'global' });
    expect(EMAIL_RATE_LIMITS['organization-deletion']).toEqual({ maxPerMinute: 1, scope: 'organization' });
  });
});

// ===== Test Factory =====

describe('createMockEmailQueueDocument', () => {
  it('creates a valid document with defaults', () => {
    const doc = createMockEmailQueueDocument();
    const result = EmailQueueDocumentSchema.parse(doc);
    expect(result.type).toBe('invitation');
    expect(result.status).toBe('pending');
    expect(result.attempts).toBe(0);
  });

  it('allows overriding defaults', () => {
    const doc = createMockEmailQueueDocument({
      type: 'password-reset',
      status: 'sent',
      to: 'custom@example.com',
    });
    expect(doc.type).toBe('password-reset');
    expect(doc.status).toBe('sent');
    expect(doc.to).toBe('custom@example.com');
  });
});
