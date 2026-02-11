/**
 * Event Firestore Operations Tests
 * Event Management Domain
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import {
  getEventRef,
  getEvent,
  createEvent,
  updateEvent,
  getBrandEvents,
  getOrganizationEvents,
} from '../events';
import { db } from '../../config';
import {
  toBranded,
  fromBranded,
  type EventId,
  type BrandId,
  type OrganizationId,
} from '@brayford/core';

// Mock Firebase
vi.mock('firebase/firestore');
vi.mock('../../config', () => ({
  db: {},
}));

describe('Event Firestore Operations', () => {
  const mockEventId = toBranded<EventId>('event123');
  const mockBrandId = toBranded<BrandId>('brand123');
  const mockOrgId = toBranded<OrganizationId>('org123');

  const mockEventData = {
    brandId: fromBranded(mockBrandId),
    organizationId: fromBranded(mockOrgId),
    name: 'Episode 42',
    venue: 'London Studio',
    scheduledDate: new Date('2026-03-30'),
    scheduledStartTime: '13:00',
    timezone: 'Europe/London',
    status: 'draft' as const,
    createdAt: new Date(),
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getEventRef', () => {
    it('returns a document reference with converter', () => {
      const mockDocRef = { withConverter: vi.fn().mockReturnThis() };
      vi.mocked(doc).mockReturnValue(mockDocRef as any);

      getEventRef(mockEventId);

      expect(doc).toHaveBeenCalledWith(db, 'events', 'event123');
      expect(mockDocRef.withConverter).toHaveBeenCalled();
    });
  });

  describe('getEvent', () => {
    it('returns event document when it exists', async () => {
      const mockDocSnap = {
        exists: () => true,
        data: () => mockEventData,
      };
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap as any);
      const mockDocRef = { withConverter: vi.fn().mockReturnThis() };
      vi.mocked(doc).mockReturnValue(mockDocRef as any);

      const result = await getEvent(mockEventId);

      expect(result).toMatchObject({
        id: mockEventId,
        name: 'Episode 42',
        venue: 'London Studio',
      });
    });

    it('returns null when event does not exist', async () => {
      const mockDocSnap = {
        exists: () => false,
      };
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap as any);
      const mockDocRef = { withConverter: vi.fn().mockReturnThis() };
      vi.mocked(doc).mockReturnValue(mockDocRef as any);

      const result = await getEvent(mockEventId);

      expect(result).toBeNull();
    });
  });

  describe('createEvent', () => {
    it('creates a new event with generated ID', async () => {
      const mockDocRef = { id: 'newEvent123' };
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(doc).mockReturnValue(mockDocRef as any);
      vi.mocked(setDoc).mockResolvedValue(undefined);

      const createData = {
        brandId: fromBranded(mockBrandId),
        organizationId: fromBranded(mockOrgId),
        name: 'New Event',
        scheduledDate: new Date('2026-04-01'),
        scheduledStartTime: '14:00',
        timezone: 'Europe/London',
      };

      const eventId = await createEvent(createData);

      expect(eventId).toBe('newEvent123');
      expect(setDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          name: 'New Event',
          createdAt: expect.anything(),
          status: 'draft',
          isActive: true,
        }),
      );
    });

    it('strips undefined values before creating', async () => {
      const mockDocRef = { id: 'newEvent123' };
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(doc).mockReturnValue(mockDocRef as any);
      vi.mocked(setDoc).mockResolvedValue(undefined);

      const createData = {
        brandId: fromBranded(mockBrandId),
        organizationId: fromBranded(mockOrgId),
        name: 'New Event',
        venue: undefined,
        scheduledDate: new Date('2026-04-01'),
        scheduledStartTime: '14:00',
        timezone: 'Europe/London',
      };

      await createEvent(createData);

      expect(setDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.not.objectContaining({
          venue: undefined,
        }),
      );
    });
  });

  describe('updateEvent', () => {
    it('updates event with partial data', async () => {
      const mockDocRef = { withConverter: vi.fn().mockReturnThis() };
      vi.mocked(doc).mockReturnValue(mockDocRef as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await updateEvent(mockEventId, {
        name: 'Updated Event',
        status: 'active',
      });

      expect(updateDoc).toHaveBeenCalledWith(mockDocRef, {
        name: 'Updated Event',
        status: 'active',
      });
    });

    it('strips undefined values before updating', async () => {
      const mockDocRef = { withConverter: vi.fn().mockReturnThis() };
      vi.mocked(doc).mockReturnValue(mockDocRef as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await updateEvent(mockEventId, {
        name: 'Updated Event',
        venue: undefined,
      });

      expect(updateDoc).toHaveBeenCalledWith(mockDocRef, {
        name: 'Updated Event',
      });
    });
  });

  describe('getBrandEvents', () => {
    it('returns all active events for a brand', async () => {
      const mockQuerySnapshot = {
        docs: [
          {
            id: 'event1',
            data: () => ({
              ...mockEventData,
              createdAt: { toDate: () => new Date() },
              scheduledDate: { toDate: () => new Date('2026-03-30') },
            }),
          },
        ],
      };
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(mockQuerySnapshot as any);

      const events = await getBrandEvents(mockBrandId);

      expect(events).toHaveLength(1);
      expect(events[0]?.name).toBe('Episode 42');
      expect(where).toHaveBeenCalledWith('brandId', '==', 'brand123');
    });

    it('filters out archived events by default', async () => {
      const mockQuerySnapshot = {
        docs: [
          {
            id: 'event1',
            data: () => ({
              ...mockEventData,
              isActive: true,
              createdAt: { toDate: () => new Date() },
              scheduledDate: { toDate: () => new Date('2026-03-30') },
            }),
          },
          {
            id: 'event2',
            data: () => ({
              ...mockEventData,
              isActive: false,
              createdAt: { toDate: () => new Date() },
              scheduledDate: { toDate: () => new Date('2026-03-30') },
            }),
          },
        ],
      };
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(mockQuerySnapshot as any);

      const events = await getBrandEvents(mockBrandId, true);

      expect(events).toHaveLength(1);
      expect(events[0]?.isActive).toBe(true);
    });
  });

  describe('getOrganizationEvents', () => {
    it('returns all active events for an organization', async () => {
      const mockQuerySnapshot = {
        docs: [
          {
            id: 'event1',
            data: () => ({
              ...mockEventData,
              createdAt: { toDate: () => new Date() },
              scheduledDate: { toDate: () => new Date('2026-03-30') },
            }),
          },
        ],
      };
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(mockQuerySnapshot as any);

      const events = await getOrganizationEvents(mockOrgId);

      expect(events).toHaveLength(1);
      expect(where).toHaveBeenCalledWith('organizationId', '==', 'org123');
    });

    it('orders events by scheduled date descending', async () => {
      const mockQuerySnapshot = { docs: [] };
      vi.mocked(collection).mockReturnValue({} as any);
      vi.mocked(query).mockReturnValue({} as any);
      vi.mocked(getDocs).mockResolvedValue(mockQuerySnapshot as any);

      await getOrganizationEvents(mockOrgId);

      expect(orderBy).toHaveBeenCalledWith('scheduledDate', 'desc');
    });
  });
});
