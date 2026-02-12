/**
 * Event Live State Schema - Interaction Domain
 * 
 * Lightweight document that tracks what audience devices should currently display.
 * Stored as a subcollection document at /events/{eventId}/live/state
 * 
 * This is deliberately separate from the main event document to:
 * 1. Avoid triggering audience listeners when event metadata changes
 * 2. Keep the real-time payload as small as possible
 * 3. Clearly separate "event config" from "live broadcast state"
 * 
 * @see docs/briefs/SCENE_SYSTEM.md for full architecture
 */

import { z } from 'zod';
import type { EventId, SceneId } from '../types/branded';

/**
 * Event live state document schema
 * 
 * @property activeSceneId - Currently displayed scene (null = no active scene / event not started)
 * @property sceneUpdatedAt - Updated when the active scene's content is edited during a live event
 * @property updatedAt - Updated on any change (scene switch or content edit)
 */
export const EventLiveStateSchema = z.object({
  activeSceneId: z.string().nullable().describe('Currently active scene ID'),
  sceneUpdatedAt: z.date().describe('Last time active scene content was modified'),
  updatedAt: z.date().describe('Last time this document was modified'),
});

export type EventLiveState = z.infer<typeof EventLiveStateSchema>;

/**
 * Event live state document with typed parent reference
 */
export interface EventLiveStateDocument extends Omit<EventLiveState, 'activeSceneId'> {
  eventId: EventId;
  activeSceneId: SceneId | null;
}

/**
 * Data for updating event live state (switching scenes)
 */
export const UpdateEventLiveStateSchema = z.object({
  activeSceneId: z.string().nullable().optional(),
  sceneUpdatedAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type UpdateEventLiveStateData = z.infer<typeof UpdateEventLiveStateSchema>;

// ===== Validation Helpers =====

export function validateEventLiveStateData(data: unknown): EventLiveState {
  return EventLiveStateSchema.parse(data);
}

export function validateUpdateEventLiveStateData(data: unknown): UpdateEventLiveStateData {
  return UpdateEventLiveStateSchema.parse(data);
}
