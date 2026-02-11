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
  });

  describe('CreateEventSchema', () => {
    it('validates event creation data', () => {
      const createData: CreateEventData = {
        brandId: 'brand123',
        organizationId: 'org123',
        name: 'Test Event',
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
