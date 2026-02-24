/**
 * Message Column Firestore Operations Tests
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

// Mock the jitter module — make it execute fn() immediately so tests are synchronous
vi.mock('../../jitter', () => ({
  withJitter: vi.fn((fn: () => any, _opts?: any) => fn()),
}));

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => {
  const mockDoc = (_db: any, ...pathSegments: string[]) => {
    const id = pathSegments[pathSegments.length - 1] || 'generated-id';
    const docRef: Record<string, any> = { id, _path: pathSegments.join('/'), _isDoc: true };
    docRef.withConverter = vi.fn(() => docRef);
    return docRef;
  };

  const mockCollection = (_db: any, ...pathSegments: string[]) => {
    const name = pathSegments.join('/');
    const collectionRef: Record<string, any> = { name, _isCollection: true };
    collectionRef.withConverter = vi.fn(() => collectionRef);
    return collectionRef;
  };

  const mockBatch = {
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  };

  return {
    doc: vi.fn(mockDoc),
    collection: vi.fn(mockCollection),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    writeBatch: vi.fn(() => mockBatch),
    increment: vi.fn((n: number) => ({ _increment: n })),
    query: vi.fn((...args: any[]) => ({ _isQuery: true, args })),
    where: vi.fn((field: string, op: string, value: any) => ({ _isWhere: true, field, op, value })),
    orderBy: vi.fn((field: string, direction?: string) => ({ _isOrderBy: true, field, direction })),
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
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  increment,
  query,
  onSnapshot,
  where,
  orderBy,
} from 'firebase/firestore';
import { withJitter } from '../../jitter';
import {
  getMessageColumnRef,
  getMessageColumn,
  getEventMessageColumns,
  createMessageColumn,
  updateMessageColumn,
  deleteMessageColumn,
  addMessageToColumn,
  removeMessageFromColumn,
  moveMessage,
  reorderMessage,
  useMessageColumns,
  useColumnMessageEntries,
} from '../message-columns';
import { db } from '../../config';
import {
  toBranded,
  fromBranded,
  type MessageColumnId,
  type MessageId,
  type EventId,
  type OrganizationId,
  type BrandId,
} from '@brayford/core';

describe('Message Column Firestore Operations', () => {
  const mockColumnId = toBranded<MessageColumnId>('col123');
  const mockEventId = toBranded<EventId>('event123');
  const mockOrgId = toBranded<OrganizationId>('org123');
  const mockBrandId = toBranded<BrandId>('brand123');
  const mockMessageId = toBranded<MessageId>('msg123');
  const mockSourceColumnId = toBranded<MessageColumnId>('col-source');
  const mockTargetColumnId = toBranded<MessageColumnId>('col-target');
  const mockNow = new Date('2026-02-01T10:00:00Z');

  const mockColumnData = {
    eventId: fromBranded(mockEventId),
    organizationId: fromBranded(mockOrgId),
    brandId: fromBranded(mockBrandId),
    name: 'Inbox',
    order: 0,
    isDefault: true,
    isBin: false,
    messageCount: 5,
    createdAt: mockNow,
    updatedAt: mockNow,
  };

  const mockNonDefaultColumnData = {
    ...mockColumnData,
    name: 'On Air',
    order: 1000,
    isDefault: false,
    messageCount: 2,
  };

  const mockEntryData = {
    messageId: fromBranded(mockMessageId),
    addedAt: mockNow,
    order: 1000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    capturedEffects.length = 0;
    stateSetters.length = 0;
  });

  // ===== getMessageColumnRef =====

  describe('getMessageColumnRef', () => {
    it('returns a document reference for the given column ID', () => {
      getMessageColumnRef(mockColumnId);

      expect(doc).toHaveBeenCalledWith(db, 'messageColumns', 'col123');
    });
  });

  // ===== getMessageColumn =====

  describe('getMessageColumn', () => {
    it('returns column document when it exists', async () => {
      const mockDocRef = { withConverter: vi.fn().mockReturnThis() };
      vi.mocked(doc).mockReturnValue(mockDocRef as any);
      const mockDocSnap = {
        exists: () => true,
        id: 'col123',
        data: () => mockColumnData,
      };
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap as any);

      const result = await getMessageColumn(mockColumnId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('col123');
      expect(result?.name).toBe('Inbox');
      expect(result?.isDefault).toBe(true);
      expect(result?.eventId).toBe('event123');
    });

    it('returns null when column does not exist', async () => {
      const mockDocRef = { withConverter: vi.fn().mockReturnThis() };
      vi.mocked(doc).mockReturnValue(mockDocRef as any);
      const mockDocSnap = { exists: () => false };
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap as any);

      const result = await getMessageColumn(mockColumnId);

      expect(result).toBeNull();
    });
  });

  // ===== getEventMessageColumns =====

  describe('getEventMessageColumns', () => {
    it('returns all columns for an event ordered by board position', async () => {
      const mockQuerySnapshot = {
        docs: [
          { id: 'col1', data: () => mockColumnData },
          { id: 'col2', data: () => mockNonDefaultColumnData },
        ],
      };
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(mockQuerySnapshot as any);

      const result = await getEventMessageColumns(mockEventId);

      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe('Inbox');
      expect(result[1]?.name).toBe('On Air');
      expect(where).toHaveBeenCalledWith('eventId', '==', 'event123');
      expect(orderBy).toHaveBeenCalledWith('order', 'asc');
    });

    it('returns empty array when no columns exist', async () => {
      const mockQuerySnapshot = { docs: [] };
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(mockQuerySnapshot as any);

      const result = await getEventMessageColumns(mockEventId);

      expect(result).toHaveLength(0);
    });
  });

  // ===== createMessageColumn =====

  describe('createMessageColumn', () => {
    it('creates a column with messageCount initialised to 0', async () => {
      const mockDocRef = { id: 'newCol123' };
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(doc).mockReturnValue(mockDocRef as any);
      vi.mocked(setDoc).mockResolvedValue(undefined);

      await createMessageColumn({
        eventId: fromBranded(mockEventId),
        organizationId: fromBranded(mockOrgId),
        brandId: fromBranded(mockBrandId),
        name: 'On Air',
        order: 1000,
        isDefault: false,
        isBin: false,
      });

      expect(setDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({ messageCount: 0 }),
      );
    });

    it('sets both createdAt and updatedAt server timestamps', async () => {
      const mockDocRef = { id: 'newCol123' };
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(doc).mockReturnValue(mockDocRef as any);
      vi.mocked(setDoc).mockResolvedValue(undefined);

      await createMessageColumn({
        eventId: fromBranded(mockEventId),
        organizationId: fromBranded(mockOrgId),
        brandId: fromBranded(mockBrandId),
        name: 'On Air',
        order: 1000,
        isDefault: false,
        isBin: false,
      });

      expect(setDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          createdAt: expect.anything(),
          updatedAt: expect.anything(),
        }),
      );
    });

    it('returns the new column ID', async () => {
      const mockDocRef = { id: 'newCol123' };
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(doc).mockReturnValue(mockDocRef as any);
      vi.mocked(setDoc).mockResolvedValue(undefined);

      const columnId = await createMessageColumn({
        eventId: fromBranded(mockEventId),
        organizationId: fromBranded(mockOrgId),
        brandId: fromBranded(mockBrandId),
        name: 'On Air',
        order: 1000,
        isDefault: false,
        isBin: false,
      });

      expect(columnId).toBe('newCol123');
    });
  });

  // ===== updateMessageColumn =====

  describe('updateMessageColumn', () => {
    it('updates the column with supplied fields and updatedAt', async () => {
      vi.mocked(doc).mockReturnValue({} as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await updateMessageColumn(mockColumnId, { name: 'Approved' });

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ name: 'Approved', updatedAt: expect.anything() }),
      );
    });

    it('uses the correct document path', async () => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await updateMessageColumn(mockColumnId, { order: 2000 });

      expect(doc).toHaveBeenCalledWith(db, 'messageColumns', 'col123');
    });
  });

  // ===== deleteMessageColumn =====

  describe('deleteMessageColumn', () => {
    it('deletes a non-default column', async () => {
      const mockDocRef = { withConverter: vi.fn().mockReturnThis() };
      vi.mocked(doc).mockReturnValue(mockDocRef as any);
      const mockDocSnap = {
        exists: () => true,
        data: () => mockNonDefaultColumnData,
      };
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap as any);
      vi.mocked(deleteDoc).mockResolvedValue(undefined);

      await deleteMessageColumn(mockColumnId);

      expect(deleteDoc).toHaveBeenCalledOnce();
    });

    it('throws when attempting to delete the default inbox column', async () => {
      const mockDocRef = { withConverter: vi.fn().mockReturnThis() };
      vi.mocked(doc).mockReturnValue(mockDocRef as any);
      const mockDocSnap = {
        exists: () => true,
        data: () => mockColumnData, // isDefault: true
      };
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap as any);

      await expect(deleteMessageColumn(mockColumnId)).rejects.toThrow(
        'Cannot delete the default inbox column',
      );
      expect(deleteDoc).not.toHaveBeenCalled();
    });

    it('returns early without deleting when the column does not exist', async () => {
      const mockDocRef = { withConverter: vi.fn().mockReturnThis() };
      vi.mocked(doc).mockReturnValue(mockDocRef as any);
      const mockDocSnap = { exists: () => false };
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap as any);

      await deleteMessageColumn(mockColumnId);

      expect(deleteDoc).not.toHaveBeenCalled();
    });
  });

  // ===== addMessageToColumn =====

  describe('addMessageToColumn', () => {
    it('writes a subcollection entry and increments messageCount atomically', async () => {
      const mockBatchInstance = {
        set: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(writeBatch).mockReturnValue(mockBatchInstance as any);
      vi.mocked(doc).mockReturnValue({} as any);

      await addMessageToColumn(mockMessageId, mockColumnId);

      expect(mockBatchInstance.set).toHaveBeenCalledOnce();
      expect(mockBatchInstance.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ messageCount: expect.anything() }),
      );
      expect(mockBatchInstance.commit).toHaveBeenCalledOnce();
    });

    it('stores messageId, addedAt, and order on the entry document', async () => {
      const mockBatchInstance = {
        set: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(writeBatch).mockReturnValue(mockBatchInstance as any);
      vi.mocked(doc).mockReturnValue({} as any);

      await addMessageToColumn(mockMessageId, mockColumnId, 3000);

      expect(mockBatchInstance.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          messageId: 'msg123',
          order: 3000,
          addedAt: expect.anything(),
        }),
      );
    });

    it('uses increment(1) for the messageCount update', async () => {
      const mockBatchInstance = {
        set: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(writeBatch).mockReturnValue(mockBatchInstance as any);
      vi.mocked(doc).mockReturnValue({} as any);

      await addMessageToColumn(mockMessageId, mockColumnId);

      expect(increment).toHaveBeenCalledWith(1);
    });
  });

  // ===== removeMessageFromColumn =====

  describe('removeMessageFromColumn', () => {
    it('deletes the subcollection entry and decrements messageCount atomically', async () => {
      const mockBatchInstance = {
        set: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(writeBatch).mockReturnValue(mockBatchInstance as any);
      vi.mocked(doc).mockReturnValue({} as any);

      await removeMessageFromColumn(mockMessageId, mockColumnId);

      expect(mockBatchInstance.delete).toHaveBeenCalledOnce();
      expect(mockBatchInstance.update).toHaveBeenCalledOnce();
      expect(mockBatchInstance.commit).toHaveBeenCalledOnce();
    });

    it('uses increment(-1) for the messageCount update', async () => {
      const mockBatchInstance = {
        set: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(writeBatch).mockReturnValue(mockBatchInstance as any);
      vi.mocked(doc).mockReturnValue({} as any);

      await removeMessageFromColumn(mockMessageId, mockColumnId);

      expect(increment).toHaveBeenCalledWith(-1);
    });
  });

  // ===== moveMessage =====

  describe('moveMessage', () => {
    it('executes via withJitter with a 500ms window', async () => {
      const mockBatchInstance = {
        set: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(writeBatch).mockReturnValue(mockBatchInstance as any);
      vi.mocked(doc).mockReturnValue({} as any);

      await moveMessage(mockMessageId, mockSourceColumnId, mockTargetColumnId, 1500);

      expect(withJitter).toHaveBeenCalledWith(
        expect.any(Function),
        { windowMs: 500 },
      );
    });

    it('deletes from source and adds to target in a single batch', async () => {
      const mockBatchInstance = {
        set: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(writeBatch).mockReturnValue(mockBatchInstance as any);
      vi.mocked(doc).mockReturnValue({} as any);

      await moveMessage(mockMessageId, mockSourceColumnId, mockTargetColumnId, 1500);

      expect(mockBatchInstance.delete).toHaveBeenCalledOnce();
      expect(mockBatchInstance.set).toHaveBeenCalledOnce();
      expect(mockBatchInstance.commit).toHaveBeenCalledOnce();
    });

    it('decrements source messageCount and increments target messageCount', async () => {
      const mockBatchInstance = {
        set: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(writeBatch).mockReturnValue(mockBatchInstance as any);
      vi.mocked(doc).mockReturnValue({} as any);

      await moveMessage(mockMessageId, mockSourceColumnId, mockTargetColumnId);

      expect(mockBatchInstance.update).toHaveBeenCalledTimes(2);
      expect(increment).toHaveBeenCalledWith(-1);
      expect(increment).toHaveBeenCalledWith(1);
    });

    it('stores the target entry with the correct messageId and order', async () => {
      const mockBatchInstance = {
        set: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(writeBatch).mockReturnValue(mockBatchInstance as any);
      vi.mocked(doc).mockReturnValue({} as any);

      await moveMessage(mockMessageId, mockSourceColumnId, mockTargetColumnId, 2500);

      expect(mockBatchInstance.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          messageId: 'msg123',
          order: 2500,
        }),
      );
    });
  });

  // ===== reorderMessage =====

  describe('reorderMessage', () => {
    it('updates only the order field on the subcollection entry', async () => {
      vi.mocked(doc).mockReturnValue({} as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await reorderMessage(mockColumnId, mockMessageId, 4000);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ order: 4000 }),
      );
      // Should not touch timestamps or other fields
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        { order: 4000 },
      );
    });

    it('uses the correct subcollection path', async () => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await reorderMessage(mockColumnId, mockMessageId, 4000);

      expect(doc).toHaveBeenCalledWith(db, 'messageColumns', 'col123', 'messages', 'msg123');
    });
  });

  // ===== useMessageColumns =====
  //
  // Hooks are tested by calling them directly (no renderHook) using the mocked
  // React above. Calling the hook pushes the useEffect callback to
  // capturedEffects. Tests then invoke it manually and drive the success/error
  // paths through the callbacks captured from onSnapshot's arguments.
  //
  // Setter spy indices in stateSetters (call order from useState calls):
  //   [0] = setColumns   [1] = setLoading   [2] = setError

  describe('useMessageColumns', () => {
    it('registers a useEffect that calls onSnapshot', () => {
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(onSnapshot).mockReturnValue(vi.fn() as any);

      useMessageColumns(mockEventId, mockOrgId);
      capturedEffects[0]?.();

      expect(onSnapshot).toHaveBeenCalledOnce();
    });

    it('queries with correct eventId filter and order', () => {
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(onSnapshot).mockReturnValue(vi.fn() as any);

      useMessageColumns(mockEventId, mockOrgId);
      capturedEffects[0]?.();

      expect(where).toHaveBeenCalledWith('eventId', '==', 'event123');
      expect(where).toHaveBeenCalledWith('organizationId', '==', 'org123');
      expect(orderBy).toHaveBeenCalledWith('order', 'asc');
    });

    it('returns the onSnapshot unsubscribe function as the effect cleanup', () => {
      const mockUnsubscribe = vi.fn();
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(onSnapshot).mockReturnValue(mockUnsubscribe as any);

      useMessageColumns(mockEventId, mockOrgId);
      const cleanup = capturedEffects[0]?.() as (() => void) | undefined;
      cleanup?.();

      expect(mockUnsubscribe).toHaveBeenCalledOnce();
    });

    it('calls setColumns with a populated array on successful snapshot', () => {
      const mockDocs = [
        { id: 'col1', data: () => mockColumnData },
        { id: 'col2', data: () => mockNonDefaultColumnData },
      ];
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(onSnapshot).mockImplementation((_q, onNext: any) => {
        onNext({ docs: mockDocs });
        return vi.fn();
      });

      useMessageColumns(mockEventId, mockOrgId);
      capturedEffects[0]?.();

      // stateSetters[0] = setColumns
      expect(stateSetters[0]).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Inbox' }),
          expect.objectContaining({ name: 'On Air' }),
        ]),
      );
    });

    it('calls setError when the snapshot fires the error callback', () => {
      const mockError = new Error('Firestore error');
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(onSnapshot).mockImplementation((_q, _onNext: any, onError: any) => {
        onError(mockError);
        return vi.fn();
      });

      useMessageColumns(mockEventId, mockOrgId);
      capturedEffects[0]?.();

      // stateSetters[2] = setError
      expect(stateSetters[2]).toHaveBeenCalledWith(mockError);
    });
  });

  // ===== useColumnMessageEntries =====
  //
  // Setter spy indices in stateSetters (call order from useState calls):
  //   [0] = setEntries   [1] = setLoading   [2] = setError

  describe('useColumnMessageEntries', () => {
    it('registers a useEffect that calls onSnapshot', () => {
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(onSnapshot).mockReturnValue(vi.fn() as any);

      useColumnMessageEntries(mockColumnId);
      capturedEffects[0]?.();

      expect(onSnapshot).toHaveBeenCalledOnce();
    });

    it('subscribes to the column messages subcollection ordered by position', () => {
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(onSnapshot).mockReturnValue(vi.fn() as any);

      useColumnMessageEntries(mockColumnId);
      capturedEffects[0]?.();

      expect(collection).toHaveBeenCalledWith(db, 'messageColumns', 'col123', 'messages');
      expect(orderBy).toHaveBeenCalledWith('order', 'asc');
    });

    it('returns the onSnapshot unsubscribe function as the effect cleanup', () => {
      const mockUnsubscribe = vi.fn();
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(onSnapshot).mockReturnValue(mockUnsubscribe as any);

      useColumnMessageEntries(mockColumnId);
      const cleanup = capturedEffects[0]?.() as (() => void) | undefined;
      cleanup?.();

      expect(mockUnsubscribe).toHaveBeenCalledOnce();
    });

    it('calls setEntries with a populated array on successful snapshot', () => {
      const mockDocs = [{ id: 'msg123', data: () => mockEntryData }];
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(onSnapshot).mockImplementation((_q, onNext: any) => {
        onNext({ docs: mockDocs });
        return vi.fn();
      });

      useColumnMessageEntries(mockColumnId);
      capturedEffects[0]?.();

      // stateSetters[0] = setEntries
      expect(stateSetters[0]).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'msg123', order: 1000, columnId: 'col123' }),
        ]),
      );
    });

    it('calls setError when the snapshot fires the error callback', () => {
      const mockError = new Error('Subcollection read error');
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(onSnapshot).mockImplementation((_q, _onNext: any, onError: any) => {
        onError(mockError);
        return vi.fn();
      });

      useColumnMessageEntries(mockColumnId);
      capturedEffects[0]?.();

      // stateSetters[2] = setError
      expect(stateSetters[2]).toHaveBeenCalledWith(mockError);
    });
  });
});
