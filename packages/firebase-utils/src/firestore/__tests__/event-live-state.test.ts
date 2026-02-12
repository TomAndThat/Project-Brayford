/**
 * Event Live State Firestore Operations Tests
 * Interaction Domain
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Firebase Firestore (factory-style — matches brands/organizations pattern)
vi.mock('firebase/firestore', () => {
  const mockDoc = (_db: any, ...pathSegments: string[]) => {
    const id = pathSegments[pathSegments.length - 1] || 'generated-id';
    const docRef: Record<string, any> = { id, _isDoc: true };
    docRef.withConverter = vi.fn(() => docRef);
    return docRef;
  };

  return {
    doc: vi.fn(mockDoc),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    onSnapshot: vi.fn(),
    serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
    arrayUnion: vi.fn((...elements: any[]) => ({ _arrayUnion: true, elements })),
    Timestamp: {
      now: vi.fn(() => ({ seconds: 1738400400, nanoseconds: 0 })),
    },
  };
});

// Mock Firebase config
vi.mock('../../config', () => ({
  db: { _isFirestore: true },
}));

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import {
  getEventLiveState,
  initializeEventLiveState,
  switchScene,
  markSceneContentUpdated,
} from '../event-live-state';
import { db } from '../../config';
import {
  toBranded,
  fromBranded,
  type EventId,
  type SceneId,
  type UserId,
} from '@brayford/core';

describe('Event Live State Firestore Operations', () => {
  const mockEventId = toBranded<EventId>('event123');
  const mockSceneId = toBranded<SceneId>('scene123');
  const mockUserId = toBranded<UserId>('user123');
  const mockNow = new Date('2026-02-01T10:00:00Z');

  const mockLiveStateData = {
    activeSceneId: null,
    sceneUpdatedAt: mockNow,
    updatedAt: mockNow,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getEventLiveState', () => {
    it('returns live state when document exists', async () => {
      const mockDocSnap = {
        exists: () => true,
        data: () => ({
          activeSceneId: null,
          sceneUpdatedAt: { toDate: () => mockNow },
          updatedAt: { toDate: () => mockNow },
        }),
      };
      vi.mocked(doc).mockReturnValue({} as any);
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap as any);

      const result = await getEventLiveState(mockEventId);

      expect(result).toMatchObject({
        eventId: mockEventId,
        activeSceneId: null,
      });
      expect(doc).toHaveBeenCalledWith(db, 'events/event123/live/state');
    });

    it('returns live state with active scene', async () => {
      const mockDocSnap = {
        exists: () => true,
        data: () => ({
          activeSceneId: 'scene123',
          sceneUpdatedAt: { toDate: () => mockNow },
          updatedAt: { toDate: () => mockNow },
        }),
      };
      vi.mocked(doc).mockReturnValue({} as any);
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap as any);

      const result = await getEventLiveState(mockEventId);

      expect(result?.activeSceneId).toBe('scene123');
    });

    it('returns null when document does not exist', async () => {
      const mockDocSnap = {
        exists: () => false,
      };
      vi.mocked(doc).mockReturnValue({} as any);
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap as any);

      const result = await getEventLiveState(mockEventId);

      expect(result).toBeNull();
    });
  });

  describe('initializeEventLiveState', () => {
    it('creates live state document with null active scene', async () => {
      vi.mocked(doc).mockReturnValue({} as any);
      vi.mocked(setDoc).mockResolvedValue(undefined);

      await initializeEventLiveState(mockEventId);

      expect(setDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          activeSceneId: null,
          sceneUpdatedAt: expect.anything(),
          updatedAt: expect.anything(),
        }),
      );
    });

    it('uses correct document path', async () => {
      vi.mocked(doc).mockReturnValue({} as any);
      vi.mocked(setDoc).mockResolvedValue(undefined);

      await initializeEventLiveState(mockEventId);

      expect(doc).toHaveBeenCalledWith(db, 'events/event123/live/state');
    });
  });

  describe('switchScene', () => {
    it('updates live state with new scene ID', async () => {
      vi.mocked(doc).mockReturnValue({} as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await switchScene(mockEventId, mockSceneId, mockUserId);

      // First updateDoc call is for live state
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          activeSceneId: 'scene123',
          updatedAt: expect.anything(),
        }),
      );
    });

    it('appends to event sceneHistory when activating a scene', async () => {
      vi.mocked(doc).mockReturnValue({} as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await switchScene(mockEventId, mockSceneId, mockUserId);

      // Second updateDoc call is for event sceneHistory
      expect(updateDoc).toHaveBeenCalledTimes(2);
    });

    it('clears active scene when sceneId is null', async () => {
      vi.mocked(doc).mockReturnValue({} as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await switchScene(mockEventId, null, mockUserId);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          activeSceneId: null,
        }),
      );
    });

    it('does not append to sceneHistory when clearing scene', async () => {
      vi.mocked(doc).mockReturnValue({} as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await switchScene(mockEventId, null, mockUserId);

      // Only one updateDoc call (live state only, no history)
      expect(updateDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe('markSceneContentUpdated', () => {
    it('updates sceneUpdatedAt and updatedAt timestamps', async () => {
      vi.mocked(doc).mockReturnValue({} as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await markSceneContentUpdated(mockEventId);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          sceneUpdatedAt: expect.anything(),
          updatedAt: expect.anything(),
        }),
      );
    });

    it('uses correct document path', async () => {
      vi.mocked(doc).mockReturnValue({} as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await markSceneContentUpdated(mockEventId);

      expect(doc).toHaveBeenCalledWith(db, 'events/event123/live/state');
    });
  });
});
