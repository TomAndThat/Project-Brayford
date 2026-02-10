import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  InvitationStatusSchema,
  InvitationRoleSchema,
  InvitationSchema,
  CreateInvitationSchema,
  UpdateInvitationSchema,
  validateInvitationData,
  validateCreateInvitationData,
  validateUpdateInvitationData,
  generateInvitationToken,
  calculateInvitationExpiry,
  isInvitationExpired,
  isInvitationActionable,
  INVITATION_EXPIRY_DAYS,
} from '../invitation.schema';
import {
  createMockInvitation,
  createMockCreateInvitationData,
} from '../../__tests__/helpers/test-factories';
import { ZodError } from 'zod';

// ===== InvitationStatusSchema =====

describe('InvitationStatusSchema', () => {
  it('accepts valid statuses', () => {
    expect(InvitationStatusSchema.parse('pending')).toBe('pending');
    expect(InvitationStatusSchema.parse('accepted')).toBe('accepted');
    expect(InvitationStatusSchema.parse('declined')).toBe('declined');
    expect(InvitationStatusSchema.parse('expired')).toBe('expired');
  });

  it('rejects invalid statuses', () => {
    expect(() => InvitationStatusSchema.parse('active')).toThrow(ZodError);
    expect(() => InvitationStatusSchema.parse('revoked')).toThrow(ZodError);
    expect(() => InvitationStatusSchema.parse('')).toThrow(ZodError);
  });
});

// ===== InvitationRoleSchema =====

describe('InvitationRoleSchema', () => {
  it('accepts valid invitation roles', () => {
    expect(InvitationRoleSchema.parse('owner')).toBe('owner');
    expect(InvitationRoleSchema.parse('admin')).toBe('admin');
    expect(InvitationRoleSchema.parse('member')).toBe('member');
  });

  it('rejects invalid roles', () => {
    expect(() => InvitationRoleSchema.parse('moderator')).toThrow(ZodError);
    expect(() => InvitationRoleSchema.parse('')).toThrow(ZodError);
  });
});

// ===== InvitationSchema =====

describe('InvitationSchema', () => {
  it('validates a complete valid invitation', () => {
    const invitation = createMockInvitation();
    const result = InvitationSchema.parse(invitation);

    expect(result.email).toBe('invitee@example.com');
    expect(result.organizationId).toBe('test-org-123');
    expect(result.status).toBe('pending');
    expect(result.role).toBe('member');
    expect(result.autoGrantNewBrands).toBe(false);
  });

  it('normalizes email to lowercase', () => {
    const invitation = createMockInvitation({ email: 'TEST@Example.COM' });
    const result = InvitationSchema.parse(invitation);
    expect(result.email).toBe('test@example.com');
  });

  it('requires a valid email address', () => {
    const invitation = createMockInvitation({ email: 'not-an-email' });
    expect(() => InvitationSchema.parse(invitation)).toThrow(ZodError);
  });

  it('requires organizationName to be non-empty', () => {
    const invitation = createMockInvitation({ organizationName: '' });
    expect(() => InvitationSchema.parse(invitation)).toThrow(ZodError);
  });

  it('requires a valid token', () => {
    const invitation = createMockInvitation({ token: '' });
    expect(() => InvitationSchema.parse(invitation)).toThrow(ZodError);
  });

  it('accepts null acceptedAt', () => {
    const invitation = createMockInvitation({ acceptedAt: null });
    const result = InvitationSchema.parse(invitation);
    expect(result.acceptedAt).toBeNull();
  });

  it('accepts a Date for acceptedAt', () => {
    const acceptedDate = new Date('2024-06-15T12:00:00Z');
    const invitation = createMockInvitation({ acceptedAt: acceptedDate });
    const result = InvitationSchema.parse(invitation);
    expect(result.acceptedAt).toEqual(acceptedDate);
  });

  it('accepts invitation without metadata', () => {
    const invitation = createMockInvitation({ metadata: undefined });
    const result = InvitationSchema.parse(invitation);
    expect(result.metadata).toBeUndefined();
  });

  it('accepts invitation with partial metadata', () => {
    const invitation = createMockInvitation({
      metadata: { inviterName: 'Jane' },
    });
    const result = InvitationSchema.parse(invitation);
    expect(result.metadata?.inviterName).toBe('Jane');
    expect(result.metadata?.inviterEmail).toBeUndefined();
  });
});

// ===== CreateInvitationSchema =====

describe('CreateInvitationSchema', () => {
  it('validates valid creation data', () => {
    const data = createMockCreateInvitationData();
    const result = CreateInvitationSchema.parse(data);

    expect(result.email).toBe('invitee@example.com');
    expect(result.organizationId).toBe('test-org-123');
    expect(result.role).toBe('member');
  });

  it('does not include invitedAt, status, or acceptedAt', () => {
    const data = createMockCreateInvitationData();
    const result = CreateInvitationSchema.parse(data);

    expect(result).not.toHaveProperty('invitedAt');
    expect(result).not.toHaveProperty('status');
    expect(result).not.toHaveProperty('acceptedAt');
  });

  it('requires token', () => {
    const { token, ...withoutToken } = createMockCreateInvitationData();
    expect(() => CreateInvitationSchema.parse(withoutToken)).toThrow(ZodError);
  });
});

// ===== UpdateInvitationSchema =====

describe('UpdateInvitationSchema', () => {
  it('validates status-only update', () => {
    const result = UpdateInvitationSchema.parse({ status: 'accepted' });
    expect(result.status).toBe('accepted');
  });

  it('validates empty update', () => {
    const result = UpdateInvitationSchema.parse({});
    expect(result).toEqual({});
  });

  it('validates update with acceptedAt date', () => {
    const now = new Date();
    const result = UpdateInvitationSchema.parse({
      status: 'accepted',
      acceptedAt: now,
    });
    expect(result.acceptedAt).toEqual(now);
  });

  it('rejects invalid status', () => {
    expect(() =>
      UpdateInvitationSchema.parse({ status: 'cancelled' })
    ).toThrow(ZodError);
  });
});

// ===== Validation Helpers =====

describe('validateInvitationData', () => {
  it('returns parsed data for valid input', () => {
    const invitation = createMockInvitation();
    const result = validateInvitationData(invitation);
    expect(result.email).toBe('invitee@example.com');
  });

  it('throws ZodError for invalid input', () => {
    expect(() => validateInvitationData({ email: 'bad' })).toThrow(ZodError);
  });
});

describe('validateCreateInvitationData', () => {
  it('returns parsed data for valid input', () => {
    const data = createMockCreateInvitationData();
    const result = validateCreateInvitationData(data);
    expect(result.email).toBe('invitee@example.com');
  });
});

describe('validateUpdateInvitationData', () => {
  it('returns parsed data for valid input', () => {
    const result = validateUpdateInvitationData({ status: 'declined' });
    expect(result.status).toBe('declined');
  });
});

// ===== Token Helpers =====

describe('generateInvitationToken', () => {
  it('returns a non-empty string', () => {
    const token = generateInvitationToken();
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('generates unique tokens', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateInvitationToken()));
    expect(tokens.size).toBe(100);
  });
});

describe('INVITATION_EXPIRY_DAYS', () => {
  it('defaults to 7 days', () => {
    expect(INVITATION_EXPIRY_DAYS).toBe(7);
  });
});

describe('calculateInvitationExpiry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calculates default expiry (7 days)', () => {
    const expiry = calculateInvitationExpiry();
    expect(expiry).toEqual(new Date('2024-06-08T12:00:00Z'));
  });

  it('calculates custom expiry', () => {
    const expiry = calculateInvitationExpiry(14);
    expect(expiry).toEqual(new Date('2024-06-15T12:00:00Z'));
  });

  it('calculates 1-day expiry', () => {
    const expiry = calculateInvitationExpiry(1);
    expect(expiry).toEqual(new Date('2024-06-02T12:00:00Z'));
  });
});

// ===== Expiry / Actionable Checks =====

describe('isInvitationExpired', () => {
  it('returns false for future expiresAt', () => {
    const future = new Date();
    future.setDate(future.getDate() + 7);
    expect(isInvitationExpired({ expiresAt: future })).toBe(false);
  });

  it('returns true for past expiresAt', () => {
    const past = new Date();
    past.setDate(past.getDate() - 1);
    expect(isInvitationExpired({ expiresAt: past })).toBe(true);
  });
});

describe('isInvitationActionable', () => {
  it('returns true for pending + not expired', () => {
    const future = new Date();
    future.setDate(future.getDate() + 7);
    expect(
      isInvitationActionable({ status: 'pending', expiresAt: future })
    ).toBe(true);
  });

  it('returns false for pending + expired', () => {
    const past = new Date();
    past.setDate(past.getDate() - 1);
    expect(
      isInvitationActionable({ status: 'pending', expiresAt: past })
    ).toBe(false);
  });

  it('returns false for accepted invitation', () => {
    const future = new Date();
    future.setDate(future.getDate() + 7);
    expect(
      isInvitationActionable({ status: 'accepted', expiresAt: future })
    ).toBe(false);
  });

  it('returns false for declined invitation', () => {
    const future = new Date();
    future.setDate(future.getDate() + 7);
    expect(
      isInvitationActionable({ status: 'declined', expiresAt: future })
    ).toBe(false);
  });

  it('returns false for expired status invitation', () => {
    const future = new Date();
    future.setDate(future.getDate() + 7);
    expect(
      isInvitationActionable({ status: 'expired', expiresAt: future })
    ).toBe(false);
  });
});
