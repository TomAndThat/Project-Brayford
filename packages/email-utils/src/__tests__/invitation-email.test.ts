/**
 * Invitation Email Helper Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendInvitationEmail, type InvitationEmailData } from '../helpers/invitation-email';
import { toBranded, type OrganizationId, type UserId } from '@brayford/core';

// Mock the dependencies
vi.mock('../client', () => ({
  sendEmail: vi.fn().mockResolvedValue({
    success: true,
    messageId: 'mock-message-id',
    to: 'invitee@example.com',
  }),
}));

vi.mock('../rate-limiter', () => ({
  withRateLimit: vi.fn((_config, fn) => fn()),
}));

vi.mock('../utils/validation', () => ({
  normalizeEmail: vi.fn((email: string) => email.toLowerCase().trim()),
}));

import { sendEmail } from '../client';
import { withRateLimit } from '../rate-limiter';

function createTestEmailData(overrides?: Partial<InvitationEmailData>): InvitationEmailData {
  return {
    recipientEmail: 'invitee@example.com',
    inviterName: 'Alice Smith',
    organizationName: 'Test Organisation',
    role: 'Member',
    invitationUrl: 'https://app.brayford.com/join?token=test-token',
    expiresAt: new Date('2024-06-08T12:00:00Z'),
    organizationId: toBranded<OrganizationId>('test-org-123'),
    invitedByUserId: toBranded<UserId>('test-user-123'),
    ...overrides,
  };
}

describe('sendInvitationEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends an email via the sendEmail client', async () => {
    const data = createTestEmailData();
    await sendInvitationEmail(data);

    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it('uses the organization-invitation template', async () => {
    const data = createTestEmailData();
    await sendInvitationEmail(data);

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        templateAlias: 'organization-invitation',
      })
    );
  });

  it('passes the correct template data', async () => {
    const data = createTestEmailData();
    await sendInvitationEmail(data);

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        templateData: expect.objectContaining({
          organizationName: 'Test Organisation',
          inviterName: 'Alice Smith',
          inviteLink: 'https://app.brayford.com/join?token=test-token',
          role: 'Member',
          expiresAt: expect.any(String), // Formatted date string
        }),
      })
    );
  });

  it('formats expiry date in UK English', async () => {
    const data = createTestEmailData({
      expiresAt: new Date('2024-06-08T12:00:00Z'),
    });
    await sendInvitationEmail(data);

    const call = (sendEmail as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    // UK English format: "8 June 2024"
    expect(call.templateData.expiresAt).toBe('8 June 2024');
  });

  it('normalizes recipient email', async () => {
    const data = createTestEmailData({
      recipientEmail: '  INVITEE@EXAMPLE.COM  ',
    });
    await sendInvitationEmail(data);

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'invitee@example.com',
      })
    );
  });

  it('applies rate limiting with organization scope', async () => {
    const data = createTestEmailData();
    await sendInvitationEmail(data);

    expect(withRateLimit).toHaveBeenCalledWith(
      {
        type: 'invitation',
        scopeId: 'test-org-123',
      },
      expect.any(Function)
    );
  });

  it('includes metadata with organizationId and userId', async () => {
    const data = createTestEmailData();
    await sendInvitationEmail(data);

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          organizationId: toBranded<OrganizationId>('test-org-123'),
          userId: toBranded<UserId>('test-user-123'),
        },
      })
    );
  });

  it('sets the email type to invitation', async () => {
    const data = createTestEmailData();
    await sendInvitationEmail(data);

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'invitation',
      })
    );
  });

  it('returns the result from sendEmail', async () => {
    const data = createTestEmailData();
    const result = await sendInvitationEmail(data);

    expect(result).toEqual({
      success: true,
      messageId: 'mock-message-id',
      to: 'invitee@example.com',
    });
  });
});
