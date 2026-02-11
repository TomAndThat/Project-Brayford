/**
 * Event Schema - Event Management Domain
 * 
 * Events represent live shows/recordings that belong to brands.
 * Examples: "Episode 42", "Q&A Session", "Live Podcast Recording"
 * 
 * Events belong to brands, and brands belong to organizations.
 * 
 * Firestore Collection: /events/{eventId}
 */

import { z } from 'zod';
import type { EventId, BrandId, OrganizationId } from '../types/branded';

/**
 * Event status lifecycle
 * 
 * draft - Still being set up, not ready
 * active - Ready to go live (scheduled)
 * live - Currently happening now
 * ended - Finished
 */
export const EventStatus = z.enum(['draft', 'active', 'live', 'ended']);
export type EventStatus = z.infer<typeof EventStatus>;

/**
 * Event document schema
 * 
 * @property brandId - Reference to parent brand
 * @property organizationId - Denormalized for efficient queries
 * @property name - Event name (e.g., "Episode 42")
 * @property venue - Optional venue name/location
 * @property scheduledDate - Date of the event
 * @property scheduledStartTime - Start time in HH:MM format (24-hour)
 * @property scheduledEndDate - Optional end date (for multi-day events)
 * @property scheduledEndTime - Optional end time in HH:MM format
 * @property timezone - IANA timezone identifier (e.g., "Europe/London", "America/Los_Angeles")
 * @property status - Current event lifecycle status
 * @property createdAt - When the event was created
 * @property isActive - Whether event is active (false = archived, hidden from UI)
 */
export const EventSchema = z.object({
  brandId: z.string().describe('Reference to parent brand'),
  organizationId: z.string().describe('Denormalized organization reference'),
  name: z.string().min(1).max(100).describe('Event name'),
  venue: z.string().min(1).max(200).optional().describe('Optional venue name/location'),
  scheduledDate: z.date().describe('Event date'),
  scheduledStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).describe('Start time in HH:MM format'),
  scheduledEndDate: z.date().optional().describe('Optional end date for multi-day events'),
  scheduledEndTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().describe('Optional end time in HH:MM format'),
  timezone: z.string().min(1).describe('IANA timezone identifier (e.g., Europe/London)'),
  status: EventStatus.default('draft').describe('Event lifecycle status'),
  createdAt: z.date().describe('Event creation timestamp'),
  isActive: z.boolean().default(true).describe('Whether event is active'),
});

export type Event = z.infer<typeof EventSchema>;

/**
 * Event document with typed ID
 */
export interface EventDocument extends Event {
  id: EventId;
  brandId: BrandId;
  organizationId: OrganizationId;
}

/**
 * Data required to create a new event
 */
export const CreateEventSchema = EventSchema.omit({
  createdAt: true,
  isActive: true,
  status: true,
});
export type CreateEventData = z.infer<typeof CreateEventSchema>;

/**
 * Data for updating an event
 */
export const UpdateEventSchema = EventSchema.partial().omit({
  brandId: true, // Cannot change parent brand
  organizationId: true, // Cannot change organization
  createdAt: true,
});
export type UpdateEventData = z.infer<typeof UpdateEventSchema>;

// ===== Validation Helpers =====

export function validateEventData(data: unknown): Event {
  return EventSchema.parse(data);
}

export function validateCreateEventData(data: unknown): CreateEventData {
  return CreateEventSchema.parse(data);
}

export function validateUpdateEventData(data: unknown): UpdateEventData {
  return UpdateEventSchema.parse(data);
}
