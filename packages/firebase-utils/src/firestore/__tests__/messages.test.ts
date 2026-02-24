/**
 * Message Firestore Operations Tests
 * Interaction Domain
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// React mock — declared first so Vitest hoists it before module imports.
//
// Testing React hooks with renderHook in this pnpm workspace causes a
// "multiple React instances" dispatcher conflict between the package-local
// react@18 devDep and the workspace-root react@19 used by @testing-library.
// Instead we mock useState/useEffect so hooks can be driven as plain functions:
//   - useEffect captures each callback; tests invoke it explicitly
//   - useState returns the initial value with a captured setter spy
// ---------------------------------------------------------------------------

const capturedEffects: Array<() => (() => void) | void> = [];
const stateSetters: Array<ReturnType<typeof vi.fn>> = [];

vi.mock('react', () => ({
  useState: vi.fn((initial: unknown) => {
    const setter = vi.fn();
    stateSetters.push(setter);
    return [initial, setter];
  }),
  useEffect: vi.fn((cb: () => (() => void) | void) => {
    capturedEffects.push(cb);
  }),
}));

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => {
  const mockDoc = (_db: any, ...pathSegments: string[]) => {
    const id = pathSegments[pathSegments.length - 1] || 'generated-id';
    const docRef: Record<string, any> = { id, _isDoc: true };
    docRef.withConverter = vi.fn(() => docRef);
    return docRef;
  };

  const mockCollection = (_db: any, ...pathSegments: string[]) => {
    const name = pathSegments.join('/');
    const collectionRef: Record<string, any> = { name, _isCollection: true };
    collectionRef.withConverter = vi.fn(() => collectionRef);
    return collectionRef;
  };

  return {
    doc: vi.fn(mockDoc),
    collection: vi.fn(mockCollection),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    updateDoc: vi.fn(),
    query: vi.fn((...args: any[]) => ({ _isQuery: true, args })),
    where: vi.fn((field: string, op: string, value: any) => ({ _isWhere: true, field, op, value })),
    orderBy: vi.fn((field: string, direction?: string) => ({ _isOrderBy: true, field, direction })),
    limit: vi.fn((n: number) => ({ _isLimit: true, n })),
    onSnapshot: vi.fn(),
    serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
    Timestamp: class MockTimestamp {
      seconds: number;
      nanoseconds: number;
      constructor(seconds: number, nanoseconds: number) {
        this.seconds = seconds;
        this.nanoseconds = nanoseconds;
      }
      toDate() { return new Date(this.seconds * 1000); }
      static now = vi.fn(() => new (class { seconds = 1738400400; nanoseconds = 0; toDate = () => new Date(1738400400 * 1000); })());
    },
  };
});

// Mock Firebase config
vi.mock('../../config', () => ({
  db: { _isFirestore: true },
}));

import {
  doc,
  collection,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import {
  getMessageRef,
  getMessage,
  getEventMessages,
  softDeleteMessage,
  restoreMessage,
  editMessage,
  clearMessageEdit,
  useMessages,
} from '../messages';
import { db } from '../../config';
import {
  toBranded,
  fromBranded,
  type MessageId,
  type EventId,
  type OrganizationId,
  type BrandId,
  MAX_INBOX_MESSAGES,
} from '@brayford/core';

describe('Message Firestore Operations', () => {
  const mockMessageId = toBranded<MessageId>('msg123');
  const mockEventId = toBranded<EventId>('event123');
  const mockOrgId = toBranded<OrganizationId>('org123');
  const mockBrandId = toBranded<BrandId>('brand123');
  const mockNow = new Date('2026-02-01T10:00:00Z');

  const mockMessageData = {
    eventId: fromBranded(mockEventId),
    organizationId: fromBranded(mockOrgId),
    brandId: fromBranded(mockBrandId),
    content: 'Hello world, this is a test message',
    editedContent: null as string | null,
    displayName: 'Test User',
    audienceUUID: '550e8400-e29b-41d4-a716-446655440000',
    isDeleted: false,
    submittedAt: mockNow,
    updatedAt: mockNow,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    capturedEffects.length = 0;
    stateSetters.length = 0;
  });

  // ===== getMessageRef =====

  describe('getMessageRef', () => {
    it('returns a document reference for the given message ID', () => {
      getMessageRef(mockMessageId);

      expect(doc).toHaveBeenCalledWith(db, 'messages', 'msg123');
    });
  });

  // ===== getMessage =====

  describe('getMessage', () => {
    it('returns message document when it exists', async () => {
      const mockDocSnap = {
        exists: () => true,
        id: 'msg123',
        data: () => mockMessageData,
      };
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap as any);

      const result = await getMessage(mockMessageId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('msg123');
      expect(result?.content).toBe('Hello world, this is a test message');
      expect(result?.editedContent).toBeNull();
      expect(result?.eventId).toBe('event123');
      expect(result?.organizationId).toBe('org123');
      expect(result?.brandId).toBe('brand123');
    });

    it('returns null when message does not exist', async () => {
      const mockDocSnap = { exists: () => false };
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap as any);

      const result = await getMessage(mockMessageId);

      expect(result).toBeNull();
    });

    it('preserves editedContent when set', async () => {
      const mockDocSnap = {
        exists: () => true,
        id: 'msg123',
        data: () => ({ ...mockMessageData, editedContent: 'Corrected content' }),
      };
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap as any);

      const result = await getMessage(mockMessageId);

      expect(result?.editedContent).toBe('Corrected content');
    });
  });

  // ===== getEventMessages =====

  describe('getEventMessages', () => {
    it('returns all non-deleted messages for an event', async () => {
      const mockQuerySnapshot = {
        docs: [
          { id: 'msg1', data: () => mockMessageData },
          { id: 'msg2', data: () => ({ ...mockMessageData, content: 'Second message here' }) },
        ],
      };
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(mockQuerySnapshot as any);

      const result = await getEventMessages(mockEventId);

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('msg1');
      expect(result[1]?.content).toBe('Second message here');
    });

    it('returns empty array when no messages exist', async () => {
      const mockQuerySnapshot = { docs: [] };
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(mockQuerySnapshot as any);

      const result = await getEventMessages(mockEventId);

      expect(result).toHaveLength(0);
    });

    it('queries with correct filters and ordering', async () => {
      const mockQuerySnapshot = { docs: [] };
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(mockQuerySnapshot as any);

      await getEventMessages(mockEventId);

      expect(where).toHaveBeenCalledWith('eventId', '==', 'event123');
      expect(where).toHaveBeenCalledWith('isDeleted', '==', false);
      expect(orderBy).toHaveBeenCalledWith('submittedAt', 'asc');
    });
  });

  // ===== softDeleteMessage =====

  describe('softDeleteMessage', () => {
    it('sets isDeleted to true', async () => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await softDeleteMessage(mockMessageId);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ isDeleted: true }),
      );
    });

    it('includes updatedAt timestamp', async () => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await softDeleteMessage(mockMessageId);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ updatedAt: expect.anything() }),
      );
    });

    it('uses the correct document path', async () => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await softDeleteMessage(mockMessageId);

      expect(doc).toHaveBeenCalledWith(db, 'messages', 'msg123');
    });
  });

  // ===== restoreMessage =====

  describe('restoreMessage', () => {
    it('sets isDeleted back to false', async () => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await restoreMessage(mockMessageId);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ isDeleted: false, updatedAt: expect.anything() }),
      );
    });
  });

  // ===== editMessage =====

  describe('editMessage', () => {
    it('sets editedContent to the provided value', async () => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await editMessage(mockMessageId, 'Fixed typo in original');

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ editedContent: 'Fixed typo in original', updatedAt: expect.anything() }),
      );
    });

    it('does not modify the original content field', async () => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await editMessage(mockMessageId, 'Edited version');

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.not.objectContaining({ content: expect.anything() }),
      );
    });
  });

  // ===== clearMessageEdit =====

  describe('clearMessageEdit', () => {
    it('sets editedContent back to null', async () => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await clearMessageEdit(mockMessageId);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ editedContent: null, updatedAt: expect.anything() }),
      );
    });
  });

  // ===== useMessages =====
  //
  // Hooks are tested by calling them directly (no renderHook) using the mocked
  // React above. Calling the hook pushes the useEffect callback to
  // capturedEffects. Tests then invoke it manually and drive the success/error
  // paths through the callbacks captured from onSnapshot's arguments.
  //
  // Setter spy indices in stateSetters (call order from useState calls):
  //   [0] = setMessages   [1] = setLoading   [2] = setError

  describe('useMessages', () => {
    it('registers a useEffect that calls onSnapshot', () => {
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(onSnapshot).mockReturnValue(vi.fn() as any);

      useMessages(mockEventId, mockOrgId);
      capturedEffects[0]?.();

      expect(onSnapshot).toHaveBeenCalledOnce();
    });

    it('queries with correct filters capped at MAX_INBOX_MESSAGES', () => {
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(onSnapshot).mockReturnValue(vi.fn() as any);

      useMessages(mockEventId, mockOrgId);
      capturedEffects[0]?.();

      expect(where).toHaveBeenCalledWith('eventId', '==', 'event123');
      expect(where).toHaveBeenCalledWith('organizationId', '==', 'org123');
      expect(where).toHaveBeenCalledWith('isDeleted', '==', false);
      expect(orderBy).toHaveBeenCalledWith('submittedAt', 'desc');
      expect(limit).toHaveBeenCalledWith(MAX_INBOX_MESSAGES);
    });

    it('returns the onSnapshot unsubscribe function as the effect cleanup', () => {
      const mockUnsubscribe = vi.fn();
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(onSnapshot).mockReturnValue(mockUnsubscribe as any);

      useMessages(mockEventId, mockOrgId);
      const cleanup = capturedEffects[0]?.() as (() => void) | undefined;
      cleanup?.();

      expect(mockUnsubscribe).toHaveBeenCalledOnce();
    });

    it('calls setMessages with a populated Map on successful snapshot', () => {
      const mockDocs = [{ id: 'msg123', data: () => mockMessageData }];
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(onSnapshot).mockImplementation((_q, onNext: any) => {
        onNext({ docs: mockDocs });
        return vi.fn();
      });

      useMessages(mockEventId, mockOrgId);
      capturedEffects[0]?.();

      // stateSetters[0] = setMessages
      expect(stateSetters[0]).toHaveBeenCalledWith(expect.any(Map));
      const passedMap: Map<MessageId, any> = vi.mocked(stateSetters[0]).mock.calls[0]?.[0];
      expect(passedMap.size).toBe(1);
      expect(passedMap.get(toBranded<MessageId>('msg123'))).toMatchObject({
        content: 'Hello world, this is a test message',
      });
    });

    it('calls setError when the snapshot fires the error callback', () => {
      const mockError = new Error('Firestore permission denied');
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(onSnapshot).mockImplementation((_q, _onNext: any, onError: any) => {
        onError(mockError);
        return vi.fn();
      });

      useMessages(mockEventId, mockOrgId);
      capturedEffects[0]?.();

      // stateSetters[2] = setError
      expect(stateSetters[2]).toHaveBeenCalledWith(mockError);
    });
  });
});
