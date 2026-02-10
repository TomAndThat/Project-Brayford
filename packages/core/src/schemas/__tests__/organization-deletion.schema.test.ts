import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DeletionRequestStatusSchema,
  DeletionActionTypeSchema,
  DeletionAuditEntrySchema,
  OrganizationDeletionRequestSchema,
  CreateDeletionRequestSchema,
  UpdateDeletionRequestSchema,
  DeletedOrganizationAuditSchema,
  validateDeletionRequestData,
  validateCreateDeletionRequestData,
  validateUpdateDeletionRequestData,
  validateDeletedOrganizationAuditData,
  generateDeletionToken,
  isConfirmationTokenExpired,
  isUndoExpired,
  isScheduledForDeletion,
  calculateTokenExpiry,
  calculateScheduledDeletion,
  addAuditEntry,
} from '../organization-deletion.schema';
import {
  createMockDeletionRequest,
  createMockCreateDeletionRequestData,
} from '../../__tests__/helpers/test-factories';
import { ZodError } from 'zod';

// ===== DeletionRequestStatusSchema =====

describe('DeletionRequestStatusSchema', () => {
  it('accepts valid statuses', () => {
    expect(DeletionRequestStatusSchema.parse('pending-email')).toBe('pending-email');
    expect(DeletionRequestStatusSchema.parse('confirmed-deletion')).toBe('confirmed-deletion');
    expect(DeletionRequestStatusSchema.parse('cancelled')).toBe('cancelled');
    expect(DeletionRequestStatusSchema.parse('completed')).toBe('completed');
  });

  it('rejects invalid statuses', () => {
    expect(() => DeletionRequestStatusSchema.parse('pending')).toThrow(ZodError);
    expect(() => DeletionRequestStatusSchema.parse('deleted')).toThrow(ZodError);
    expect(() => DeletionRequestStatusSchema.parse('')).toThrow(ZodError);
  });
});

// ===== DeletionActionTypeSchema =====

describe('DeletionActionTypeSchema', () => {
  it('accepts valid action types', () => {
    expect(DeletionActionTypeSchema.parse('email-link')).toBe('email-link');
    expect(DeletionActionTypeSchema.parse('manual-undo')).toBe('manual-undo');
    expect(DeletionActionTypeSchema.parse('system-cleanup')).toBe('system-cleanup');
  });

  it('rejects invalid action types', () => {
    expect(() => DeletionActionTypeSchema.parse('api')).toThrow(ZodError);
    expect(() => DeletionActionTypeSchema.parse('')).toThrow(ZodError);
  });
});

// ===== DeletionAuditEntrySchema =====

describe('DeletionAuditEntrySchema', () => {
  it('validates a complete audit entry', () => {
    const entry = {
      timestamp: new Date('2026-02-01T10:00:00Z'),
      action: 'Deletion requested',
      userId: 'test-user-123',
    };
    const result = DeletionAuditEntrySchema.parse(entry);
    expect(result.action).toBe('Deletion requested');
    expect(result.userId).toBe('test-user-123');
  });

  it('accepts null userId for system actions', () => {
    const entry = {
      timestamp: new Date(),
      action: 'Permanent deletion executed',
      userId: null,
    };
    const result = DeletionAuditEntrySchema.parse(entry);
    expect(result.userId).toBeNull();
  });

  it('accepts optional metadata', () => {
    const entry = {
      timestamp: new Date(),
      action: 'Deletion undone',
      userId: 'test-user-456',
      metadata: { reason: 'Accidental deletion' },
    };
    const result = DeletionAuditEntrySchema.parse(entry);
    expect(result.metadata).toEqual({ reason: 'Accidental deletion' });
  });
});

// ===== OrganizationDeletionRequestSchema =====

describe('OrganizationDeletionRequestSchema', () => {
  it('validates a complete pending deletion request', () => {
    const request = createMockDeletionRequest();
    const result = OrganizationDeletionRequestSchema.parse(request);

    expect(result.organizationId).toBe('test-org-123');
    expect(result.organizationName).toBe('Test Organization');
    expect(result.status).toBe('pending-email');
    expect(result.confirmedAt).toBeNull();
    expect(result.scheduledDeletionAt).toBeNull();
  });

  it('validates a confirmed deletion request', () => {
    const confirmedAt = new Date();
    const scheduledDeletionAt = new Date();
    scheduledDeletionAt.setDate(scheduledDeletionAt.getDate() + 28);
    const undoExpiresAt = new Date();
    undoExpiresAt.setHours(undoExpiresAt.getHours() + 24);

    const request = createMockDeletionRequest({
      status: 'confirmed-deletion',
      confirmedAt,
      confirmedVia: 'email-link',
      scheduledDeletionAt,
      undoToken: 'undo-token-uuid',
      undoExpiresAt,
    });
    const result = OrganizationDeletionRequestSchema.parse(request);

    expect(result.status).toBe('confirmed-deletion');
    expect(result.confirmedAt).toEqual(confirmedAt);
    expect(result.confirmedVia).toBe('email-link');
    expect(result.scheduledDeletionAt).toEqual(scheduledDeletionAt);
    expect(result.undoToken).toBe('undo-token-uuid');
  });

  it('requires non-empty organizationName', () => {
    const request = createMockDeletionRequest({ organizationName: '' });
    expect(() => OrganizationDeletionRequestSchema.parse(request)).toThrow(ZodError);
  });

  it('requires non-empty confirmationToken', () => {
    const request = createMockDeletionRequest({ confirmationToken: '' });
    expect(() => OrganizationDeletionRequestSchema.parse(request)).toThrow(ZodError);
  });

  it('requires a valid status', () => {
    const request = createMockDeletionRequest({ status: 'invalid' as any });
    expect(() => OrganizationDeletionRequestSchema.parse(request)).toThrow(ZodError);
  });

  it('requires auditLog to be an array', () => {
    const request = createMockDeletionRequest({ auditLog: 'not-array' as any });
    expect(() => OrganizationDeletionRequestSchema.parse(request)).toThrow(ZodError);
  });
});

// ===== CreateDeletionRequestSchema =====

describe('CreateDeletionRequestSchema', () => {
  it('validates valid creation data', () => {
    const data = createMockCreateDeletionRequestData();
    const result = CreateDeletionRequestSchema.parse(data);

    expect(result.organizationId).toBe('test-org-123');
    expect(result.confirmationToken).toBe('test-confirmation-token-uuid');
  });

  it('requires organizationId', () => {
    const { organizationId, ...withoutOrgId } = createMockCreateDeletionRequestData();
    expect(() => CreateDeletionRequestSchema.parse(withoutOrgId)).toThrow(ZodError);
  });

  it('requires confirmationToken', () => {
    const { confirmationToken, ...withoutToken } = createMockCreateDeletionRequestData();
    expect(() => CreateDeletionRequestSchema.parse(withoutToken)).toThrow(ZodError);
  });

  it('requires requestedBy', () => {
    const { requestedBy, ...withoutUser } = createMockCreateDeletionRequestData();
    expect(() => CreateDeletionRequestSchema.parse(withoutUser)).toThrow(ZodError);
  });
});

// ===== UpdateDeletionRequestSchema =====

describe('UpdateDeletionRequestSchema', () => {
  it('accepts partial updates', () => {
    const result = UpdateDeletionRequestSchema.parse({
      status: 'confirmed-deletion',
    });
    expect(result.status).toBe('confirmed-deletion');
  });

  it('accepts status and confirmedAt together', () => {
    const confirmedAt = new Date();
    const result = UpdateDeletionRequestSchema.parse({
      status: 'confirmed-deletion',
      confirmedAt,
      confirmedVia: 'email-link',
    });
    expect(result.status).toBe('confirmed-deletion');
    expect(result.confirmedAt).toEqual(confirmedAt);
  });

  it('accepts cancel update', () => {
    const result = UpdateDeletionRequestSchema.parse({
      status: 'cancelled',
      scheduledDeletionAt: null,
      undoToken: null,
    });
    expect(result.status).toBe('cancelled');
    expect(result.scheduledDeletionAt).toBeNull();
  });

  it('rejects invalid status', () => {
    expect(() =>
      UpdateDeletionRequestSchema.parse({ status: 'invalid-status' })
    ).toThrow(ZodError);
  });
});

// ===== DeletedOrganizationAuditSchema =====

describe('DeletedOrganizationAuditSchema', () => {
  it('validates a complete audit record', () => {
    const audit = {
      organizationId: 'test-org-123',
      organizationName: 'Test Organization',
      deletionRequestId: 'deletion-req-123',
      requestedBy: 'test-user-123',
      requestedAt: new Date('2026-02-01T10:00:00Z'),
      confirmedAt: new Date('2026-02-01T12:00:00Z'),
      completedAt: new Date('2026-03-01T02:00:00Z'),
      memberCount: 5,
      brandCount: 2,
      auditLog: [
        {
          timestamp: new Date('2026-02-01T10:00:00Z'),
          action: 'Deletion requested',
          userId: 'test-user-123',
        },
      ],
    };
    const result = DeletedOrganizationAuditSchema.parse(audit);
    expect(result.organizationName).toBe('Test Organization');
    expect(result.memberCount).toBe(5);
    expect(result.brandCount).toBe(2);
  });

  it('requires numeric memberCount', () => {
    const audit = {
      organizationId: 'test-org-123',
      organizationName: 'Test Organization',
      deletionRequestId: 'deletion-req-123',
      requestedBy: 'test-user-123',
      requestedAt: new Date(),
      confirmedAt: new Date(),
      completedAt: new Date(),
      memberCount: 'five',
      brandCount: 2,
      auditLog: [],
    };
    expect(() => DeletedOrganizationAuditSchema.parse(audit)).toThrow(ZodError);
  });
});

// ===== Token Helpers =====

describe('generateDeletionToken', () => {
  it('generates a non-empty string', () => {
    const token = generateDeletionToken();
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('generates unique tokens', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateDeletionToken()));
    expect(tokens.size).toBe(100);
  });
});

// ===== Expiry Helpers =====

describe('isConfirmationTokenExpired', () => {
  it('returns false for future tokenExpiresAt', () => {
    const future = new Date();
    future.setHours(future.getHours() + 24);
    expect(isConfirmationTokenExpired({ tokenExpiresAt: future })).toBe(false);
  });

  it('returns true for past tokenExpiresAt', () => {
    const past = new Date();
    past.setHours(past.getHours() - 1);
    expect(isConfirmationTokenExpired({ tokenExpiresAt: past })).toBe(true);
  });
});

describe('isUndoExpired', () => {
  it('returns true when undoExpiresAt is null', () => {
    expect(isUndoExpired({ undoExpiresAt: null })).toBe(true);
  });

  it('returns false for future undoExpiresAt', () => {
    const future = new Date();
    future.setHours(future.getHours() + 24);
    expect(isUndoExpired({ undoExpiresAt: future })).toBe(false);
  });

  it('returns true for past undoExpiresAt', () => {
    const past = new Date();
    past.setHours(past.getHours() - 1);
    expect(isUndoExpired({ undoExpiresAt: past })).toBe(true);
  });
});

describe('isScheduledForDeletion', () => {
  it('returns true when status is confirmed-deletion with scheduled date', () => {
    const request = createMockDeletionRequest({
      status: 'confirmed-deletion',
      scheduledDeletionAt: new Date(),
    });
    expect(isScheduledForDeletion(request)).toBe(true);
  });

  it('returns false when status is pending-email', () => {
    const request = createMockDeletionRequest({
      status: 'pending-email',
      scheduledDeletionAt: null,
    });
    expect(isScheduledForDeletion(request)).toBe(false);
  });

  it('returns false when status is cancelled', () => {
    const request = createMockDeletionRequest({
      status: 'cancelled',
      scheduledDeletionAt: null,
    });
    expect(isScheduledForDeletion(request)).toBe(false);
  });

  it('returns false when confirmed but no scheduled date', () => {
    const request = createMockDeletionRequest({
      status: 'confirmed-deletion',
      scheduledDeletionAt: null,
    });
    expect(isScheduledForDeletion(request)).toBe(false);
  });
});

// ===== Date Calculation Helpers =====

describe('calculateTokenExpiry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-01T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a date 24 hours from now', () => {
    const expiry = calculateTokenExpiry();
    const expected = new Date('2026-02-02T10:00:00Z');
    expect(expiry.getTime()).toBe(expected.getTime());
  });
});

describe('calculateScheduledDeletion', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-01T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a date 28 days from now', () => {
    const scheduled = calculateScheduledDeletion();
    const expected = new Date('2026-03-01T10:00:00Z');
    expect(scheduled.getTime()).toBe(expected.getTime());
  });
});

// ===== Audit Log Helpers =====

describe('addAuditEntry', () => {
  it('appends new entry to existing audit log', () => {
    const request = createMockDeletionRequest();
    const originalLength = request.auditLog.length;

    const updatedLog = addAuditEntry(
      request,
      'Deletion confirmed via email',
      'test-user-123'
    );

    expect(updatedLog).toHaveLength(originalLength + 1);
    expect(updatedLog[updatedLog.length - 1]!.action).toBe('Deletion confirmed via email');
    expect(updatedLog[updatedLog.length - 1]!.userId).toBe('test-user-123');
  });

  it('does not mutate the original audit log', () => {
    const request = createMockDeletionRequest();
    const originalLength = request.auditLog.length;

    addAuditEntry(request, 'Test action', 'test-user-123');

    expect(request.auditLog).toHaveLength(originalLength);
  });

  it('supports null userId for system actions', () => {
    const request = createMockDeletionRequest();
    const updatedLog = addAuditEntry(
      request,
      'Permanent deletion executed by scheduled function',
      null
    );

    expect(updatedLog[updatedLog.length - 1]!.userId).toBeNull();
  });

  it('supports optional metadata', () => {
    const request = createMockDeletionRequest();
    const updatedLog = addAuditEntry(
      request,
      'Undo requested',
      'test-user-456',
      { undoToken: 'undo-123' }
    );

    expect(updatedLog[updatedLog.length - 1]!.metadata).toEqual({ undoToken: 'undo-123' });
  });
});

// ===== Validation Helpers =====

describe('validateDeletionRequestData', () => {
  it('returns parsed data for valid input', () => {
    const request = createMockDeletionRequest();
    const result = validateDeletionRequestData(request);
    expect(result.organizationId).toBe('test-org-123');
  });

  it('throws ZodError for invalid input', () => {
    expect(() => validateDeletionRequestData({})).toThrow(ZodError);
  });
});

describe('validateCreateDeletionRequestData', () => {
  it('returns parsed data for valid input', () => {
    const data = createMockCreateDeletionRequestData();
    const result = validateCreateDeletionRequestData(data);
    expect(result.confirmationToken).toBe('test-confirmation-token-uuid');
  });

  it('throws ZodError for invalid input', () => {
    expect(() => validateCreateDeletionRequestData({})).toThrow(ZodError);
  });
});

describe('validateUpdateDeletionRequestData', () => {
  it('returns parsed data for valid partial update', () => {
    const result = validateUpdateDeletionRequestData({ status: 'cancelled' });
    expect(result.status).toBe('cancelled');
  });

  it('throws ZodError for invalid status', () => {
    expect(() =>
      validateUpdateDeletionRequestData({ status: 'invalid' })
    ).toThrow(ZodError);
  });
});

describe('validateDeletedOrganizationAuditData', () => {
  it('returns parsed data for valid audit', () => {
    const audit = {
      organizationId: 'test-org-123',
      organizationName: 'Test Organization',
      deletionRequestId: 'deletion-req-123',
      requestedBy: 'test-user-123',
      requestedAt: new Date(),
      confirmedAt: new Date(),
      completedAt: new Date(),
      memberCount: 3,
      brandCount: 1,
      auditLog: [],
    };
    const result = validateDeletedOrganizationAuditData(audit);
    expect(result.memberCount).toBe(3);
  });

  it('throws ZodError for invalid input', () => {
    expect(() => validateDeletedOrganizationAuditData({})).toThrow(ZodError);
  });
});
