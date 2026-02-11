/**
 * Event Schema Tests
 * Event Management Domain
 */

import { describe, it, expect } from 'vitest';
import {
  EventSchema,
  CreateEventSchema,
  UpdateEventSchema,
  EventStatus,
  EventType,
  validateEventData,
  validateCreateEventData,
  validateUpdateEventData,
  type Event,
  type CreateEventData,
  type UpdateEventData,
} from '../event.schema';

describe('EventSchema', () => {
  const validEventData: Event = {
    brandId: 'brand123',
    organizationId: 'org123',
    name: 'Episode 42',
    eventType: 'event',
    venue: 'London Studio',
    scheduledDate: new Date('2026-03-30'),
    scheduledStartTime: '13:00',
    scheduledEndDate: new Date('2026-03-30'),
    scheduledEndTime: '15:00',
    timezone: 'Europe/London',
    status: 'draft',
    createdAt: new Date(),
    isActive: true,
  };

  describe('Event Schema Validation', () => {
    it('validates a complete event document', () => {
      expect(() => EventSchema.parse(validEventData)).not.toThrow();
    });

    it('validates event with minimal required fields', () => {
      const minimalEvent = {
        brandId: 'brand123',
        organizationId: 'org123',
        name: 'Test Event',
        eventType: 'event',
        scheduledDate: new Date('2026-03-30'),
        scheduledStartTime: '13:00',
        timezone: 'Europe/London',
        status: 'draft',
        createdAt: new Date(),
        isActive: true,
      };
      expect(() => EventSchema.parse(minimalEvent)).not.toThrow();
    });

    it('rejects event with empty name', () => {
      const invalidData = { ...validEventData, name: '' };
      expect(() => EventSchema.parse(invalidData)).toThrow();
    });

    it('rejects event with name longer than 100 characters', () => {
      const invalidData = { ...validEventData, name: 'a'.repeat(101) };
      expect(() => EventSchema.parse(invalidData)).toThrow();
    });

    it('rejects event with venue longer than 200 characters', () => {
      const invalidData = { ...validEventData, venue: 'a'.repeat(201) };
      expect(() => EventSchema.parse(invalidData)).toThrow();
    });

    it('rejects event with invalid start time format', () => {
      const invalidData = { ...validEventData, scheduledStartTime: '25:00' };
      expect(() => EventSchema.parse(invalidData)).toThrow();
    });

    it('rejects event with invalid end time format', () => {
      const invalidData = { ...validEventData, scheduledEndTime: '1:00pm' };
      expect(() => EventSchema.parse(invalidData)).toThrow();
    });

    it('accepts valid 24-hour time formats', () => {
      const times = ['00:00', '12:00', '23:59', '13:30'];
      times.forEach((time) => {
        const data = { ...validEventData, scheduledStartTime: time };
        expect(() => EventSchema.parse(data)).not.toThrow();
      });
    });

    it('accepts valid status values', () => {
      const statuses = ['draft', 'active', 'live', 'ended'] as const;
      statuses.forEach((status) => {
        const data = { ...validEventData, status };
        expect(() => EventSchema.parse(data)).not.toThrow();
      });
    });

    it('rejects invalid status values', () => {
      const invalidData = { ...validEventData, status: 'cancelled' };
      expect(() => EventSchema.parse(invalidData)).toThrow();
    });

    it('accepts valid IANA timezone identifiers', () => {
      const timezones = [
        'Europe/London',
        'America/New_York',
        'Asia/Tokyo',
        'Australia/Sydney',
        'UTC',
      ];
      timezones.forEach((timezone) => {
        const data = { ...validEventData, timezone };
        expect(() => EventSchema.parse(data)).not.toThrow();
      });
    });

    it('defaults status to "draft"', () => {
      const dataWithoutStatus = { ...validEventData };
      delete (dataWithoutStatus as any).status;
      const parsed = EventSchema.parse(dataWithoutStatus);
      expect(parsed.status).toBe('draft');
    });

    it('defaults isActive to true', () => {
      const dataWithoutIsActive = { ...validEventData };
      delete (dataWithoutIsActive as any).isActive;
      const parsed = EventSchema.parse(dataWithoutIsActive);
      expect(parsed.isActive).toBe(true);
    });

    it('accepts optional parentEventId for event groups', () => {
      const dataWithParent = { ...validEventData, parentEventId: 'parent123' };
      expect(() => EventSchema.parse(dataWithParent)).not.toThrow();
    });

    it('accepts optional maxAttendees capacity limit', () => {
      const dataWithCapacity = { ...validEventData, maxAttendees: 500 };
      expect(() => EventSchema.parse(dataWithCapacity)).not.toThrow();
    });

    it('rejects negative maxAttendees', () => {
      const invalidData = { ...validEventData, maxAttendees: -10 };
      expect(() => EventSchema.parse(invalidData)).toThrow();
    });

    it('rejects zero maxAttendees', () => {
      const invalidData = { ...validEventData, maxAttendees: 0 };
      expect(() => EventSchema.parse(invalidData)).toThrow();
    });

    it('rejects non-integer maxAttendees', () => {
      const invalidData = { ...validEventData, maxAttendees: 100.5 };
      expect(() => EventSchema.parse(invalidData)).toThrow();
    });

    it('accepts eventType "event"', () => {
      const data = { ...validEventData, eventType: 'event' as const };
      expect(() => EventSchema.parse(data)).not.toThrow();
    });

    it('accepts eventType "group"', () => {
      const data = { ...validEventData, eventType: 'group' as const, parentEventId: undefined };
      expect(() => EventSchema.parse(data)).not.toThrow();
    });

    it('defaults eventType to "event"', () => {
      const dataWithoutType = { ...validEventData };
      delete (dataWithoutType as any).eventType;
      const parsed = EventSchema.parse(dataWithoutType);
      expect(parsed.eventType).toBe('event');
    });

    it('rejects event groups with parentEventId', () => {
      const invalidGroup = { 
        ...validEventData, 
        eventType: 'group' as const, 
        parentEventId: 'parent123' 
      };
      expect(() => EventSchema.parse(invalidGroup)).toThrow('Event groups cannot have a parent event');
    });

    it('allows regular events with parentEventId', () => {
      const validChild = { 
        ...validEventData, 
        eventType: 'event' as const, 
        parentEventId: 'group123' 
      };
      expect(() => EventSchema.parse(validChild)).not.toThrow();
    });

    it('allows regular events without parentEventId (standalone)', () => {
      const standalone = { 
        ...validEventData, 
        eventType: 'event' as const, 
        parentEventId: undefined 
      };
      expect(() => EventSchema.parse(standalone)).not.toThrow();
    });
  });

  describe('CreateEventSchema', () => {
    it('validates event creation data', () => {
      const createData: CreateEventData = {
        brandId: 'brand123',
        organizationId: 'org123',
        name: 'Test Event',
        eventType: 'event',
        venue: 'London Studio',
        scheduledDate: new Date('2026-03-30'),
        scheduledStartTime: '13:00',
        timezone: 'Europe/London',
      };
      expect(() => CreateEventSchema.parse(createData)).not.toThrow();
    });

    it('accepts creation data without optional fields', () => {
      const createData = {
        brandId: 'brand123',
        organizationId: 'org123',
        name: 'Test Event',
        eventType: 'event',
        scheduledDate: new Date('2026-03-30'),
        scheduledStartTime: '13:00',
        timezone: 'Europe/London',
      };
      expect(() => CreateEventSchema.parse(createData)).not.toThrow();
    });

    it('does not require createdAt field', () => {
      const createData = {
        brandId: 'brand123',
        organizationId: 'org123',
        name: 'Test Event',
        scheduledDate: new Date('2026-03-30'),
        scheduledStartTime: '13:00',
        timezone: 'Europe/London',
        createdAt: new Date(), // Should be omitted
      };
      const parsed = CreateEventSchema.parse(createData);
      expect((parsed as any).createdAt).toBeUndefined();
    });

    it('does not require status field', () => {
      const createData = {
        brandId: 'brand123',
        organizationId: 'org123',
        name: 'Test Event',
        scheduledDate: new Date('2026-03-30'),
        scheduledStartTime: '13:00',
        timezone: 'Europe/London',
        status: 'active', // Should be omitted
      };
      const parsed = CreateEventSchema.parse(createData);
      expect((parsed as any).status).toBeUndefined();
    });

    it('accepts optional end date and time', () => {
      const createData = {
        brandId: 'brand123',
        organizationId: 'org123',
        name: 'Test Event',
        scheduledDate: new Date('2026-03-30'),
        scheduledStartTime: '13:00',
        scheduledEndDate: new Date('2026-03-30'),
        scheduledEndTime: '15:00',
        timezone: 'Europe/London',
      };
      expect(() => CreateEventSchema.parse(createData)).not.toThrow();
    });

    it('accepts optional parentEventId for child events', () => {
      const createData = {
        brandId: 'brand123',
        organizationId: 'org123',
        name: 'Test Event',
        scheduledDate: new Date('2026-03-30'),
        scheduledStartTime: '13:00',
        timezone: 'Europe/London',
        parentEventId: 'parent123',
      };
      expect(() => CreateEventSchema.parse(createData)).not.toThrow();
    });

    it('accepts optional maxAttendees', () => {
      const createData = {
        brandId: 'brand123',
        organizationId: 'org123',
        name: 'Test Event',
        eventType: 'event',
        scheduledDate: new Date('2026-03-30'),
        scheduledStartTime: '13:00',
        timezone: 'Europe/London',
        maxAttendees: 1000,
      };
      expect(() => CreateEventSchema.parse(createData)).not.toThrow();
    });

    it('requires eventType field', () => {
      const createData = {
        brandId: 'brand123',
        organizationId: 'org123',
        name: 'Test Event',
        scheduledDate: new Date('2026-03-30'),
        scheduledStartTime: '13:00',
        timezone: 'Europe/London',
        // eventType omitted
      };
      const parsed = CreateEventSchema.parse(createData);
      // Should default to 'event'
      expect(parsed.eventType).toBe('event');
    });

    it('allows creating event groups', () => {
      const createData = {
        brandId: 'brand123',
        organizationId: 'org123',
        name: 'Festival 2026',
        eventType: 'group',
        scheduledDate: new Date('2026-03-30'),
        scheduledStartTime: '13:00',
        timezone: 'Europe/London',
      };
      expect(() => CreateEventSchema.parse(createData)).not.toThrow();
    });

    it('prevents creating groups with parentEventId', () => {
      const createData = {
        brandId: 'brand123',
        organizationId: 'org123',
        name: 'Festival 2026',
        eventType: 'group',
        scheduledDate: new Date('2026-03-30'),
        scheduledStartTime: '13:00',
        timezone: 'Europe/London',
        parentEventId: 'parent123',
      };
      expect(() => CreateEventSchema.parse(createData)).toThrow('Event groups cannot have a parent event');
    });
  });

  describe('UpdateEventSchema', () => {
    it('validates partial event updates', () => {
      const updateData: UpdateEventData = {
        name: 'Updated Event Name',
      };
      expect(() => UpdateEventSchema.parse(updateData)).not.toThrow();
    });

    it('allows updating multiple fields', () => {
      const updateData: UpdateEventData = {
        name: 'Updated Event',
        venue: 'New Venue',
        scheduledStartTime: '14:00',
        status: 'active',
      };
      expect(() => UpdateEventSchema.parse(updateData)).not.toThrow();
    });

    it('allows updating optional fields to undefined (removal)', () => {
      const updateData = {
        venue: undefined,
        scheduledEndDate: undefined,
        scheduledEndTime: undefined,
      };
      expect(() => UpdateEventSchema.parse(updateData)).not.toThrow();
    });

    it('does not allow changing brandId', () => {
      const updateData = {
        name: 'Updated Event',
        brandId: 'newBrand123', // Should be omitted
      };
      const parsed = UpdateEventSchema.parse(updateData);
      expect((parsed as any).brandId).toBeUndefined();
    });

    it('does not allow changing organizationId', () => {
      const updateData = {
        name: 'Updated Event',
        organizationId: 'newOrg123', // Should be omitted
      };
      const parsed = UpdateEventSchema.parse(updateData);
      expect((parsed as any).organizationId).toBeUndefined();
    });

    it('does not allow changing createdAt', () => {
      const updateData = {
        name: 'Updated Event',
        createdAt: new Date(), // Should be omitted
      };
      const parsed = UpdateEventSchema.parse(updateData);
      expect((parsed as any).createdAt).toBeUndefined();
    });

    it('validates time format in updates', () => {
      const invalidUpdate = {
        scheduledStartTime: 'invalid-time',
      };
      expect(() => UpdateEventSchema.parse(invalidUpdate)).toThrow();
    });

    it('allows updating parentEventId', () => {
      const updateData: UpdateEventData = {
        parentEventId: 'newParent123',
      };
      expect(() => UpdateEventSchema.parse(updateData)).not.toThrow();
    });

    it('allows updating maxAttendees', () => {
      const updateData: UpdateEventData = {
        maxAttendees: 2000,
      };
      expect(() => UpdateEventSchema.parse(updateData)).not.toThrow();
    });

    it('allows removing parentEventId', () => {
      const updateData = {
        parentEventId: undefined,
      };
      expect(() => UpdateEventSchema.parse(updateData)).not.toThrow();
    });

    it('does not allow changing eventType', () => {
      const updateData = {
        name: 'Updated Event',
        eventType: 'group', // Should be omitted
      };
      const parsed = UpdateEventSchema.parse(updateData);
      expect((parsed as any).eventType).toBeUndefined();
    });
  });

  describe('EventType Enum', () => {
    it('includes all valid type values', () => {
      expect(EventType.enum.group).toBe('group');
      expect(EventType.enum.event).toBe('event');
    });

    it('rejects invalid type values', () => {
      expect(() => EventType.parse('container')).toThrow();
      expect(() => EventType.parse('session')).toThrow();
    });
  });

  describe('EventStatus Enum', () => {
    it('includes all valid status values', () => {
      expect(EventStatus.enum.draft).toBe('draft');
      expect(EventStatus.enum.active).toBe('active');
      expect(EventStatus.enum.live).toBe('live');
      expect(EventStatus.enum.ended).toBe('ended');
    });

    it('rejects invalid status values', () => {
      expect(() => EventStatus.parse('cancelled')).toThrow();
      expect(() => EventStatus.parse('pending')).toThrow();
    });
  });

  describe('Validation Helper Functions', () => {
    it('validateEventData accepts valid event', () => {
      expect(() => validateEventData(validEventData)).not.toThrow();
    });

    it('validateEventData throws on invalid event', () => {
      const invalidData = { ...validEventData, name: '' };
      expect(() => validateEventData(invalidData)).toThrow();
    });

    it('validateCreateEventData accepts valid creation data', () => {
      const createData = {
        brandId: 'brand123',
        organizationId: 'org123',
        name: 'Test Event',
        scheduledDate: new Date('2026-03-30'),
        scheduledStartTime: '13:00',
        timezone: 'Europe/London',
      };
      expect(() => validateCreateEventData(createData)).not.toThrow();
    });

    it('validateUpdateEventData accepts valid update data', () => {
      const updateData = { name: 'Updated Name' };
      expect(() => validateUpdateEventData(updateData)).not.toThrow();
    });
  });
});
