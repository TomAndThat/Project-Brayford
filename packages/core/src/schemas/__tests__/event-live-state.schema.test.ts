/**
 * Event Live State Schema Tests
 * Interaction Domain
 */

import { describe, it, expect } from 'vitest';
import {
  EventLiveStateSchema,
  UpdateEventLiveStateSchema,
  validateEventLiveStateData,
  validateUpdateEventLiveStateData,
} from '../event-live-state.schema';
import { createMockEventLiveState } from '../../__tests__/helpers/test-factories';
import { ZodError } from 'zod';

describe('EventLiveStateSchema', () => {
  describe('validation success cases', () => {
    it('validates a complete live state with no active scene', () => {
      const state = createMockEventLiveState();
      const result = EventLiveStateSchema.parse(state);

      expect(result.activeSceneId).toBeNull();
      expect(result.sceneUpdatedAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('validates a live state with an active scene', () => {
      const state = createMockEventLiveState({
        activeSceneId: 'scene-123',
      });
      const result = EventLiveStateSchema.parse(state);
      expect(result.activeSceneId).toBe('scene-123');
    });

    it('accepts null activeSceneId (no scene active)', () => {
      const state = createMockEventLiveState({ activeSceneId: null });
      const result = EventLiveStateSchema.parse(state);
      expect(result.activeSceneId).toBeNull();
    });
  });

  describe('validation failure cases', () => {
    it('rejects missing required fields', () => {
      const requiredFields = ['activeSceneId', 'sceneUpdatedAt', 'updatedAt'];

      requiredFields.forEach((field) => {
        const state = createMockEventLiveState();
        delete (state as any)[field];
        expect(() => EventLiveStateSchema.parse(state)).toThrow(ZodError);
      });
    });

    it('rejects non-Date sceneUpdatedAt', () => {
      const state = { ...createMockEventLiveState(), sceneUpdatedAt: 'not-a-date' };
      expect(() => EventLiveStateSchema.parse(state)).toThrow(ZodError);
    });

    it('rejects non-Date updatedAt', () => {
      const state = { ...createMockEventLiveState(), updatedAt: 12345 };
      expect(() => EventLiveStateSchema.parse(state)).toThrow(ZodError);
    });
  });
});

describe('UpdateEventLiveStateSchema', () => {
  it('validates updating activeSceneId', () => {
    const result = UpdateEventLiveStateSchema.parse({
      activeSceneId: 'new-scene',
    });
    expect(result.activeSceneId).toBe('new-scene');
  });

  it('validates clearing activeSceneId to null', () => {
    const result = UpdateEventLiveStateSchema.parse({
      activeSceneId: null,
    });
    expect(result.activeSceneId).toBeNull();
  });

  it('validates empty update (no fields)', () => {
    const result = UpdateEventLiveStateSchema.parse({});
    expect(result).toBeDefined();
  });

  it('validates updating multiple fields', () => {
    const now = new Date();
    const result = UpdateEventLiveStateSchema.parse({
      activeSceneId: 'scene-456',
      sceneUpdatedAt: now,
      updatedAt: now,
    });

    expect(result.activeSceneId).toBe('scene-456');
    expect(result.sceneUpdatedAt).toEqual(now);
    expect(result.updatedAt).toEqual(now);
  });
});

describe('Validation helpers', () => {
  it('validateEventLiveStateData parses valid state', () => {
    const state = createMockEventLiveState();
    const result = validateEventLiveStateData(state);
    expect(result.activeSceneId).toBeNull();
  });

  it('validateEventLiveStateData throws on invalid data', () => {
    expect(() => validateEventLiveStateData({})).toThrow(ZodError);
  });

  it('validateUpdateEventLiveStateData parses valid update', () => {
    const result = validateUpdateEventLiveStateData({ activeSceneId: 'scene-1' });
    expect(result.activeSceneId).toBe('scene-1');
  });
});
