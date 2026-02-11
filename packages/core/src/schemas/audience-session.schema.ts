/**
 * Audience Session Schema - Audience Domain
 * 
 * Tracks individual audience member sessions at events.
 * Used for billing, analytics, and interaction linking.
 * 
 * Firestore Collection: /audienceSessions/{sessionId}
 */

import { z } from 'zod';
import type { EventId, OrganizationId, QRCodeId } from '../types/branded';

/**
 * Audience session document schema
 * 
 * @property eventId - Reference to the event
 * @property organizationId - Denormalized for efficient queries and billing
 * @property audienceUUID - Unique identifier from localStorage (for tracking unique users)
 * @property qrCodeId - Which QR code was scanned to enter
 * @property joinedAt - When the audience member joined
 * @property lastSeenAt - Last activity timestamp (updated periodically)
 * @property isActive - Whether the session is currently active
 */
export const AudienceSessionSchema = z.object({
  eventId: z.string().describe('Reference to parent event'),
  organizationId: z.string().describe('Denormalized organization reference for billing'),
  audienceUUID: z.string().uuid().describe('Unique identifier from localStorage'),
  qrCodeId: z.string().describe('Which QR code was scanned'),
  joinedAt: z.date().describe('Timestamp when user joined the event'),
  lastSeenAt: z.date().describe('Last activity timestamp'),
  isActive: z.boolean().default(true).describe('Whether session is currently active'),
});

export type AudienceSession = z.infer<typeof AudienceSessionSchema>;

/**
 * Audience session document with typed ID
 */
export interface AudienceSessionDocument extends AudienceSession {
  id: string; // Session ID is just a regular string (document ID in Firestore)
  eventId: EventId;
  organizationId: OrganizationId;
  qrCodeId: QRCodeId;
}

/**
 * Data required to create a new audience session
 */
export const CreateAudienceSessionSchema = AudienceSessionSchema.omit({
  joinedAt: true,
  lastSeenAt: true,
  isActive: true,
});
export type CreateAudienceSessionData = z.infer<typeof CreateAudienceSessionSchema>;

/**
 * Data for updating an audience session
 */
export const UpdateAudienceSessionSchema = AudienceSessionSchema.partial().omit({
  eventId: true, // Cannot change event
  organizationId: true, // Cannot change organization
  audienceUUID: true, // Cannot change UUID
  qrCodeId: true, // Cannot change QR code
  joinedAt: true, // Cannot change join time
});
export type UpdateAudienceSessionData = z.infer<typeof UpdateAudienceSessionSchema>;

// ===== Validation Helpers =====

export function validateAudienceSessionData(data: unknown): AudienceSession {
  return AudienceSessionSchema.parse(data);
}

export function validateCreateAudienceSessionData(data: unknown): CreateAudienceSessionData {
  return CreateAudienceSessionSchema.parse(data);
}

export function validateUpdateAudienceSessionData(data: unknown): UpdateAudienceSessionData {
  return UpdateAudienceSessionSchema.parse(data);
}
