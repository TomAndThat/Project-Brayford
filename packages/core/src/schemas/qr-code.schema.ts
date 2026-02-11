/**
 * QR Code Schema - Event Management Domain
 * 
 * QR codes allow audience members to join events by scanning.
 * Each event can have multiple QR codes for different purposes
 * (security invalidation, referral tracking, etc.)
 * 
 * Firestore Collection: /qrCodes/{qrCodeId}
 */

import { z } from 'zod';
import type { QRCodeId, EventId, OrganizationId } from '../types/branded';

/**
 * QR Code document schema
 * 
 * @property eventId - Reference to parent event
 * @property organizationId - Denormalized for efficient queries
 * @property code - Unique code used in URL (generated, unpredictable)
 * @property name - User-friendly label (e.g., "Main QR Code", "Social Media")
 * @property isActive - Whether the QR code is currently valid
 * @property createdAt - When the QR code was created
 */
export const QRCodeSchema = z.object({
  eventId: z.string().describe('Reference to parent event'),
  organizationId: z.string().describe('Denormalized organization reference'),
  code: z.string().min(1).describe('Unique code for URL (unpredictable string)'),
  name: z.string().min(1).max(100).describe('User-friendly label for the QR code'),
  isActive: z.boolean().default(true).describe('Whether QR code is active'),
  createdAt: z.date().describe('QR code creation timestamp'),
});

export type QRCode = z.infer<typeof QRCodeSchema>;

/**
 * QR Code document with typed ID
 */
export interface QRCodeDocument extends QRCode {
  id: QRCodeId;
  eventId: EventId;
  organizationId: OrganizationId;
}

/**
 * Data required to create a new QR code
 */
export const CreateQRCodeSchema = QRCodeSchema.omit({
  createdAt: true,
  isActive: true,
  code: true, // Server-generated
});
export type CreateQRCodeData = z.infer<typeof CreateQRCodeSchema>;

/**
 * Data for updating a QR code
 */
export const UpdateQRCodeSchema = QRCodeSchema.partial().omit({
  eventId: true, // Cannot change parent event
  organizationId: true, // Cannot change organization
  createdAt: true,
  code: true, // Cannot change code (security)
});
export type UpdateQRCodeData = z.infer<typeof UpdateQRCodeSchema>;

// ===== Validation Helpers =====

export function validateQRCodeData(data: unknown): QRCode {
  return QRCodeSchema.parse(data);
}

export function validateCreateQRCodeData(data: unknown): CreateQRCodeData {
  return CreateQRCodeSchema.parse(data);
}

export function validateUpdateQRCodeData(data: unknown): UpdateQRCodeData {
  return UpdateQRCodeSchema.parse(data);
}

/**
 * Generate a unique, unpredictable QR code
 * Uses crypto.randomUUID() for security
 * 
 * @returns Unique code string (UUID format)
 */
export function generateQRCode(): string {
  // Using UUID v4 for unpredictability and uniqueness
  // Example: "550e8400-e29b-41d4-a716-446655440000"
  return crypto.randomUUID();
}

/**
 * Build the audience app URL for a QR code
 * 
 * @param audienceAppUrl - Base URL from environment variable
 * @param eventId - Event ID
 * @param qrCodeId - QR Code ID
 * @returns Full URL for QR code
 * 
 * @example
 * ```ts
 * const url = buildQRCodeUrl(
 *   'https://audience.brayford.app',
 *   eventId,
 *   qrCodeId
 * );
 * // returns: "https://audience.brayford.app/events/abc123/join/def456"
 * ```
 */
export function buildQRCodeUrl(
  audienceAppUrl: string,
  eventId: string,
  qrCodeId: string
): string {
  // Remove trailing slash from base URL
  const baseUrl = audienceAppUrl.replace(/\/$/, '');
  return `${baseUrl}/events/${eventId}/join/${qrCodeId}`;
}
