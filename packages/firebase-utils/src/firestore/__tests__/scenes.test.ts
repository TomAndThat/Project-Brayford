/**
 * Scene Firestore Operations Tests
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

  const mockCollection = (_db: any, name: string) => {
    const collectionRef: Record<string, any> = { name, _isCollection: true };
    collectionRef.withConverter = vi.fn(() => collectionRef);
    return collectionRef;
  };

  return {
    doc: vi.fn(mockDoc),
    collection: vi.fn(mockCollection),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    query: vi.fn((...args: any[]) => ({ _isQuery: true, args })),
    where: vi.fn((field: string, op: string, value: any) => ({ _isWhere: true, field, op, value })),
    orderBy: vi.fn((field: string, direction: string) => ({ _isOrderBy: true, field, direction })),
    serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
  };
});

// Mock Firebase config
vi.mock('../../config', () => ({
  db: { _isFirestore: true },
}));

import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import {
  getSceneRef,
  getScene,
  createScene,
  updateScene,
  deleteScene,
  getEventScenes,
  getOrganizationScenes,
  getBrandScenes,
  duplicateScene,
} from '../scenes';
import { db } from '../../config';
import {
  toBranded,
  fromBranded,
  type SceneId,
  type BrandId,
  type EventId,
  type OrganizationId,
  type UserId,
} from '@brayford/core';

describe('Scene Firestore Operations', () => {
  const mockSceneId = toBranded<SceneId>('scene123');
  const mockBrandId = toBranded<BrandId>('brand123');
  const mockEventId = toBranded<EventId>('event123');
  const mockOrgId = toBranded<OrganizationId>('org123');
  const mockUserId = toBranded<UserId>('user123');

  const mockSceneData = {
    organizationId: fromBranded(mockOrgId),
    brandId: fromBranded(mockBrandId),
    eventId: fromBranded(mockEventId),
    name: 'Welcome Screen',
    description: 'Opening scene',
    modules: [
      { id: 'mod-1', moduleType: 'text', order: 0, config: { content: 'Hello' } },
    ],
    createdAt: new Date('2026-02-01T10:00:00Z'),
    updatedAt: new Date('2026-02-01T10:00:00Z'),
    createdBy: fromBranded(mockUserId),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSceneRef', () => {
    it('returns a document reference with converter', () => {
      const mockDocRef = { withConverter: vi.fn().mockReturnThis() };
      vi.mocked(doc).mockReturnValue(mockDocRef as any);

      getSceneRef(mockSceneId);

      expect(doc).toHaveBeenCalledWith(db, 'scenes', 'scene123');
      expect(mockDocRef.withConverter).toHaveBeenCalled();
    });
  });

  describe('getScene', () => {
    it('returns scene document when it exists', async () => {
      const mockDocSnap = {
        exists: () => true,
        data: () => mockSceneData,
      };
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap as any);
      const mockDocRef = { withConverter: vi.fn().mockReturnThis() };
      vi.mocked(doc).mockReturnValue(mockDocRef as any);

      const result = await getScene(mockSceneId);

      expect(result).toMatchObject({
        id: mockSceneId,
        name: 'Welcome Screen',
        modules: expect.arrayContaining([
          expect.objectContaining({ id: 'mod-1', moduleType: 'text' }),
        ]),
      });
    });

    it('returns null when scene does not exist', async () => {
      const mockDocSnap = {
        exists: () => false,
      };
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap as any);
      const mockDocRef = { withConverter: vi.fn().mockReturnThis() };
      vi.mocked(doc).mockReturnValue(mockDocRef as any);

      const result = await getScene(mockSceneId);

      expect(result).toBeNull();
    });

    it('sets eventId and brandId to null for org-wide scenes', async () => {
      const orgWideData = { ...mockSceneData, brandId: null, eventId: null };
      const mockDocSnap = {
        exists: () => true,
        data: () => orgWideData,
      };
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap as any);
      const mockDocRef = { withConverter: vi.fn().mockReturnThis() };
      vi.mocked(doc).mockReturnValue(mockDocRef as any);

      const result = await getScene(mockSceneId);

      expect(result?.brandId).toBeNull();
      expect(result?.eventId).toBeNull();
    });
  });

  describe('createScene', () => {
    it('creates a new scene with generated ID', async () => {
      const mockDocRef = { id: 'newScene123' };
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(doc).mockReturnValue(mockDocRef as any);
      vi.mocked(setDoc).mockResolvedValue(undefined);

      const createData = {
        eventId: fromBranded(mockEventId),
        organizationId: fromBranded(mockOrgId),
        name: 'New Scene',
        modules: [],
        createdBy: fromBranded(mockUserId),
      };

      const sceneId = await createScene(createData);

      expect(sceneId).toBe('newScene123');
      expect(setDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          name: 'New Scene',
          modules: [],
          createdAt: expect.anything(),
          updatedAt: expect.anything(),
        }),
      );
    });

    it('strips undefined values before creating', async () => {
      const mockDocRef = { id: 'newScene123' };
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(doc).mockReturnValue(mockDocRef as any);
      vi.mocked(setDoc).mockResolvedValue(undefined);

      const createData = {
        eventId: fromBranded(mockEventId),
        organizationId: fromBranded(mockOrgId),
        name: 'New Scene',
        description: undefined,
        modules: [],
        createdBy: fromBranded(mockUserId),
      };

      await createScene(createData);

      expect(setDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.not.objectContaining({
          description: undefined,
        }),
      );
    });
  });

  describe('updateScene', () => {
    it('updates scene with partial data', async () => {
      const mockDocRef = { withConverter: vi.fn().mockReturnThis() };
      vi.mocked(doc).mockReturnValue(mockDocRef as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await updateScene(mockSceneId, {
        name: 'Updated Scene',
      });

      expect(updateDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          name: 'Updated Scene',
          updatedAt: expect.anything(),
        }),
      );
    });

    it('strips undefined values before updating', async () => {
      const mockDocRef = { withConverter: vi.fn().mockReturnThis() };
      vi.mocked(doc).mockReturnValue(mockDocRef as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await updateScene(mockSceneId, {
        name: 'Updated',
        description: undefined,
      });

      expect(updateDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.not.objectContaining({
          description: undefined,
        }),
      );
    });

    it('always includes updatedAt timestamp', async () => {
      const mockDocRef = { withConverter: vi.fn().mockReturnThis() };
      vi.mocked(doc).mockReturnValue(mockDocRef as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await updateScene(mockSceneId, { name: 'Test' });

      expect(updateDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          updatedAt: expect.anything(),
        }),
      );
    });
  });

  describe('deleteScene', () => {
    it('deletes a scene document', async () => {
      const mockDocRef = {};
      vi.mocked(doc).mockReturnValue(mockDocRef as any);
      vi.mocked(deleteDoc).mockResolvedValue(undefined);

      await deleteScene(mockSceneId);

      expect(doc).toHaveBeenCalledWith(db, 'scenes', 'scene123');
      expect(deleteDoc).toHaveBeenCalledWith(mockDocRef);
    });
  });

  describe('getEventScenes', () => {
    it('returns all scenes for an event ordered by creation date', async () => {
      const mockQuerySnapshot = {
        docs: [
          {
            id: 'scene1',
            data: () => ({
              ...mockSceneData,
              createdAt: { toDate: () => new Date('2026-02-01T10:00:00Z') },
              updatedAt: { toDate: () => new Date('2026-02-01T10:00:00Z') },
            }),
          },
        ],
      };
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(mockQuerySnapshot as any);

      const scenes = await getEventScenes(mockEventId);

      expect(scenes).toHaveLength(1);
      expect(scenes[0]?.name).toBe('Welcome Screen');
      expect(where).toHaveBeenCalledWith('eventId', '==', 'event123');
      expect(orderBy).toHaveBeenCalledWith('createdAt', 'asc');
    });

    it('returns empty array when no scenes exist', async () => {
      const mockQuerySnapshot = { docs: [] };
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(mockQuerySnapshot as any);

      const scenes = await getEventScenes(mockEventId);

      expect(scenes).toHaveLength(0);
    });
  });

  describe('getOrganizationScenes', () => {
    it('queries for org-wide scenes (brandId and eventId null)', async () => {
      const mockQuerySnapshot = { docs: [] };
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(mockQuerySnapshot as any);

      await getOrganizationScenes(mockOrgId);

      expect(where).toHaveBeenCalledWith('organizationId', '==', 'org123');
      expect(where).toHaveBeenCalledWith('brandId', '==', null);
      expect(where).toHaveBeenCalledWith('eventId', '==', null);
    });
  });

  describe('getBrandScenes', () => {
    it('queries for brand-scoped scenes (eventId null)', async () => {
      const mockQuerySnapshot = { docs: [] };
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(mockQuerySnapshot as any);

      await getBrandScenes(mockBrandId);

      expect(where).toHaveBeenCalledWith('brandId', '==', 'brand123');
      expect(where).toHaveBeenCalledWith('eventId', '==', null);
    });
  });

  describe('duplicateScene', () => {
    it('creates a copy of an existing scene to a new scope', async () => {
      // Mock getScene (source)
      const mockDocSnap = {
        exists: () => true,
        data: () => mockSceneData,
      };
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap as any);
      
      // Mock doc refs for both getScene and createScene
      const mockGetRef = { withConverter: vi.fn().mockReturnThis() };
      const mockNewRef = { id: 'duplicated123' };
      vi.mocked(doc)
        .mockReturnValueOnce(mockGetRef as any)  // getSceneRef
        .mockReturnValueOnce(mockNewRef as any);  // createScene new doc
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(setDoc).mockResolvedValue(undefined);

      const newBrandId = toBranded<BrandId>('new-brand-456');
      const newEventId = toBranded<EventId>('new-event-456');
      const newSceneId = await duplicateScene(
        mockSceneId,
        { brandId: newBrandId, eventId: newEventId },
        mockUserId,
      );

      expect(newSceneId).toBe('duplicated123');
      expect(setDoc).toHaveBeenCalledWith(
        mockNewRef,
        expect.objectContaining({
          name: 'Welcome Screen',
          brandId: 'new-brand-456',
          eventId: 'new-event-456',
        }),
      );
    });

    it('throws when source scene is not found', async () => {
      const mockDocSnap = {
        exists: () => false,
      };
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap as any);
      const mockDocRef = { withConverter: vi.fn().mockReturnThis() };
      vi.mocked(doc).mockReturnValue(mockDocRef as any);

      await expect(
        duplicateScene(mockSceneId, { brandId: null, eventId: null }, mockUserId)
      ).rejects.toThrow('Scene not found');
    });

    it('creates an org-wide scene when brandId and eventId are null', async () => {
      const mockDocSnap = {
        exists: () => true,
        data: () => mockSceneData,
      };
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap as any);
      
      const mockGetRef = { withConverter: vi.fn().mockReturnThis() };
      const mockNewRef = { id: 'orgwide123' };
      vi.mocked(doc)
        .mockReturnValueOnce(mockGetRef as any)
        .mockReturnValueOnce(mockNewRef as any);
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(setDoc).mockResolvedValue(undefined);

      const newSceneId = await duplicateScene(
        mockSceneId,
        { brandId: null, eventId: null },
        mockUserId,
      );

      expect(newSceneId).toBe('orgwide123');
      expect(setDoc).toHaveBeenCalledWith(
        mockNewRef,
        expect.objectContaining({
          brandId: null,
          eventId: null,
        }),
      );
    });
  });
});
