import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  createConverter,
  convertFromFirestore,
  convertToFirestore,
} from '../converters';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';

// Mock validator function
const mockValidator = vi.fn((data: unknown) => data);

// Helper to create a mock Firestore Timestamp
function createMockTimestamp(date: Date): Timestamp {
  return Timestamp.fromDate(date);
}

describe('createConverter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('toFirestore', () => {
    it('converts Date fields to Timestamps', () => {
      const converter = createConverter(mockValidator, ['createdAt', 'updatedAt']);
      const testDate = new Date('2024-01-01T00:00:00Z');
      
      const data = {
        name: 'Test',
        createdAt: testDate,
        updatedAt: testDate,
      };

      const result = converter.toFirestore(data);
      
      expect(result.name).toBe('Test');
      expect(result.createdAt).toBeInstanceOf(Timestamp);
      expect(result.updatedAt).toBeInstanceOf(Timestamp);
      expect((result.createdAt as Timestamp).toDate()).toEqual(testDate);
    });

    it('handles already-converted Timestamps', () => {
      const converter = createConverter(mockValidator, ['createdAt']);
      const testDate = new Date('2024-01-01T00:00:00Z');
      const timestamp = createMockTimestamp(testDate);
      
      const data = {
        name: 'Test',
        createdAt: timestamp,
      };

      const result = converter.toFirestore(data);
      
      expect(result.createdAt).toBeInstanceOf(Timestamp);
      expect((result.createdAt as Timestamp).toDate()).toEqual(testDate);
    });

    it('preserves non-timestamp fields unchanged', () => {
      const converter = createConverter(mockValidator, ['createdAt']);
      
      const data = {
        name: 'Test',
        count: 42,
        isActive: true,
        tags: ['tag1', 'tag2'],
        nested: { key: 'value' },
        createdAt: new Date(),
      };

      const result = converter.toFirestore(data);
      
      expect(result.name).toBe('Test');
      expect(result.count).toBe(42);
      expect(result.isActive).toBe(true);
      expect(result.tags).toEqual(['tag1', 'tag2']);
      expect(result.nested).toEqual({ key: 'value' });
    });

    it('handles empty timestamp fields list', () => {
      const converter = createConverter(mockValidator, []);
      const testDate = new Date('2024-01-01T00:00:00Z');
      
      const data = {
        name: 'Test',
        someDate: testDate,
      };

      const result = converter.toFirestore(data);
      
      // With no timestamp fields specified, dates are not converted
      expect(result.someDate).toBeInstanceOf(Date);
    });

    it('handles null timestamp values', () => {
      const converter = createConverter(mockValidator, ['createdAt']);
      
      const data = {
        name: 'Test',
        createdAt: null,
      };

      const result = converter.toFirestore(data);
      
      // Null values are not converted
      expect(result.createdAt).toBeNull();
    });

    it('handles undefined timestamp values', () => {
      const converter = createConverter(mockValidator, ['createdAt']);
      
      const data = {
        name: 'Test',
      };

      const result = converter.toFirestore(data);
      
      expect(result).not.toHaveProperty('createdAt');
    });
  });

  describe('fromFirestore', () => {
    it('converts Timestamp fields to Dates', () => {
      const validator = vi.fn((data: unknown) => data);
      const converter = createConverter(validator, ['createdAt', 'updatedAt']);
      
      const testDate = new Date('2024-01-01T00:00:00Z');
      const mockSnapshot = {
        data: () => ({
          name: 'Test',
          createdAt: createMockTimestamp(testDate),
          updatedAt: createMockTimestamp(testDate),
        }),
      } as QueryDocumentSnapshot;

      const result = converter.fromFirestore(mockSnapshot);
      
      expect(validator).toHaveBeenCalledWith({
        name: 'Test',
        createdAt: testDate,
        updatedAt: testDate,
      });
    });

    it('handles already-converted Dates', () => {
      const validator = vi.fn((data: unknown) => data);
      const converter = createConverter(validator, ['createdAt']);
      
      const testDate = new Date('2024-01-01T00:00:00Z');
      const mockSnapshot = {
        data: () => ({
          name: 'Test',
          createdAt: testDate,
        }),
      } as QueryDocumentSnapshot;

      const result = converter.fromFirestore(mockSnapshot);
      
      expect(validator).toHaveBeenCalledWith({
        name: 'Test',
        createdAt: testDate,
      });
    });

    it('calls validator with converted data', () => {
      const validator = vi.fn((data: unknown) => ({ validated: true, ...data }));
      const converter = createConverter(validator, ['createdAt']);
      
      const mockSnapshot = {
        data: () => ({
          name: 'Test',
          createdAt: createMockTimestamp(new Date()),
        }),
      } as QueryDocumentSnapshot;

      const result = converter.fromFirestore(mockSnapshot);
      
      expect(validator).toHaveBeenCalledOnce();
      expect(result).toHaveProperty('validated', true);
    });

    it('handles null timestamp values', () => {
      const validator = vi.fn((data: unknown) => data);
      const converter = createConverter(validator, ['createdAt']);
      
      const mockSnapshot = {
        data: () => ({
          name: 'Test',
          createdAt: null,
        }),
      } as QueryDocumentSnapshot;

      const result = converter.fromFirestore(mockSnapshot);
      
      expect(validator).toHaveBeenCalledWith({
        name: 'Test',
        createdAt: null,
      });
    });

    it('handles snapshot options', () => {
      const validator = vi.fn((data: unknown) => data);
      const converter = createConverter(validator, ['createdAt']);
      
      const mockData = {
        name: 'Test',
        createdAt: createMockTimestamp(new Date()),
      };
      
      const mockSnapshot = {
        data: (options?: any) => {
          expect(options).toEqual({ serverTimestamps: 'estimate' });
          return mockData;
        },
      } as QueryDocumentSnapshot;

      converter.fromFirestore(mockSnapshot, { serverTimestamps: 'estimate' });
      
      expect(validator).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('handles multiple timestamp fields', () => {
      const converter = createConverter(mockValidator, [
        'createdAt',
        'updatedAt',
        'deletedAt',
        'publishedAt',
      ]);
      
      const dates = {
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        deletedAt: new Date('2024-01-03'),
        publishedAt: new Date('2024-01-04'),
      };

      const result = converter.toFirestore({ ...dates });
      
      Object.keys(dates).forEach((key) => {
        expect(result[key]).toBeInstanceOf(Timestamp);
      });
    });

    it('handles objects without specified timestamp fields', () => {
      const converter = createConverter(mockValidator, ['createdAt']);
      
      const data = {
        name: 'Test',
        count: 42,
      };

      const result = converter.toFirestore(data);
      
      expect(result).toEqual(data);
    });

    it('does not modify original data object', () => {
      const converter = createConverter(mockValidator, ['createdAt']);
      
      const originalData = {
        name: 'Test',
        createdAt: new Date('2024-01-01'),
      };
      
      const originalDate = originalData.createdAt;
      converter.toFirestore(originalData);
      
      // Original should be unchanged
      expect(originalData.createdAt).toBe(originalDate);
      expect(originalData.createdAt).toBeInstanceOf(Date);
    });
  });
});

describe('convertFromFirestore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('converts Timestamps to Dates and validates', () => {
    const validator = vi.fn((data: unknown) => data);
    const testDate = new Date('2024-01-01T00:00:00Z');
    
    const firestoreData = {
      name: 'Test',
      createdAt: createMockTimestamp(testDate),
    };

    const result = convertFromFirestore(firestoreData, validator, ['createdAt']);
    
    expect(validator).toHaveBeenCalledWith({
      name: 'Test',
      createdAt: testDate,
    });
  });

  it('handles multiple timestamp fields', () => {
    const validator = vi.fn((data: unknown) => data);
    const date1 = new Date('2024-01-01');
    const date2 = new Date('2024-01-02');
    
    const firestoreData = {
      name: 'Test',
      createdAt: createMockTimestamp(date1),
      updatedAt: createMockTimestamp(date2),
    };

    convertFromFirestore(firestoreData, validator, ['createdAt', 'updatedAt']);
    
    expect(validator).toHaveBeenCalledWith({
      name: 'Test',
      createdAt: date1,
      updatedAt: date2,
    });
  });

  it('handles data without timestamp fields', () => {
    const validator = vi.fn((data: unknown) => data);
    
    const firestoreData = {
      name: 'Test',
      count: 42,
    };

    convertFromFirestore(firestoreData, validator, ['createdAt']);
    
    expect(validator).toHaveBeenCalledWith({
      name: 'Test',
      count: 42,
    });
  });

  it('handles empty timestamp fields array', () => {
    const validator = vi.fn((data: unknown) => data);
    
    const firestoreData = {
      name: 'Test',
      createdAt: createMockTimestamp(new Date()),
    };

    convertFromFirestore(firestoreData, validator, []);
    
    // Without timestamp fields specified, Timestamps are not converted
    expect(validator).toHaveBeenCalledWith(firestoreData);
  });

  it('preserves non-timestamp fields', () => {
    const validator = vi.fn((data: unknown) => data);
    
    const firestoreData = {
      name: 'Test',
      count: 42,
      tags: ['tag1', 'tag2'],
      metadata: { key: 'value' },
      createdAt: createMockTimestamp(new Date()),
    };

    convertFromFirestore(firestoreData, validator, ['createdAt']);
    
    const callArg = validator.mock.calls[0][0] as any;
    expect(callArg.name).toBe('Test');
    expect(callArg.count).toBe(42);
    expect(callArg.tags).toEqual(['tag1', 'tag2']);
    expect(callArg.metadata).toEqual({ key: 'value' });
  });

  it('returns validated result from validator', () => {
    const validator = vi.fn((data: unknown) => ({
      ...data,
      validated: true,
    }));
    
    const result = convertFromFirestore({ name: 'Test' }, validator, []);
    
    expect(result).toHaveProperty('validated', true);
  });
});

describe('convertToFirestore', () => {
  it('converts Dates to Timestamps', () => {
    const testDate = new Date('2024-01-01T00:00:00Z');
    
    const data = {
      name: 'Test',
      createdAt: testDate,
    };

    const result = convertToFirestore(data, ['createdAt']);
    
    expect(result.name).toBe('Test');
    expect(result.createdAt).toBeInstanceOf(Timestamp);
    expect((result.createdAt as Timestamp).toDate()).toEqual(testDate);
  });

  it('handles multiple timestamp fields', () => {
    const date1 = new Date('2024-01-01');
    const date2 = new Date('2024-01-02');
    
    const data = {
      name: 'Test',
      createdAt: date1,
      updatedAt: date2,
    };

    const result = convertToFirestore(data, ['createdAt', 'updatedAt']);
    
    expect(result.createdAt).toBeInstanceOf(Timestamp);
    expect(result.updatedAt).toBeInstanceOf(Timestamp);
  });

  it('preserves non-timestamp fields', () => {
    const data = {
      name: 'Test',
      count: 42,
      isActive: true,
      createdAt: new Date(),
    };

    const result = convertToFirestore(data, ['createdAt']);
    
    expect(result.name).toBe('Test');
    expect(result.count).toBe(42);
    expect(result.isActive).toBe(true);
  });

  it('handles empty timestamp fields array', () => {
    const testDate = new Date('2024-01-01');
    
    const data = {
      name: 'Test',
      createdAt: testDate,
    };

    const result = convertToFirestore(data, []);
    
    // Without timestamp fields, dates are not converted
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it('does not modify original data object', () => {
    const originalData = {
      name: 'Test',
      createdAt: new Date('2024-01-01'),
    };
    
    const originalDate = originalData.createdAt;
    const result = convertToFirestore(originalData, ['createdAt']);
    
    // Original should be unchanged
    expect(originalData.createdAt).toBe(originalDate);
    expect(originalData.createdAt).toBeInstanceOf(Date);
  });
});

describe('converter round-trip', () => {
  it('maintains data integrity through to/from conversions', () => {
    const validator = vi.fn((data: unknown) => data);
    const converter = createConverter(validator, ['createdAt', 'updatedAt']);
    
    const originalDate1 = new Date('2024-01-01T10:30:00Z');
    const originalDate2 = new Date('2024-01-02T15:45:00Z');
    
    const originalData = {
      name: 'Test User',
      email: 'test@example.com',
      count: 42,
      createdAt: originalDate1,
      updatedAt: originalDate2,
    };

    // Convert to Firestore format
    const firestoreData = converter.toFirestore(originalData);
    
    // Simulate Firestore snapshot
    const mockSnapshot = {
      data: () => firestoreData,
    } as QueryDocumentSnapshot;

    // Convert back from Firestore
    const result = converter.fromFirestore(mockSnapshot);
    
    // Dates should be equal (but different instances)
    expect((result as any).createdAt).toEqual(originalDate1);
    expect((result as any).updatedAt).toEqual(originalDate2);
    expect((result as any).name).toBe(originalData.name);
    expect((result as any).email).toBe(originalData.email);
    expect((result as any).count).toBe(originalData.count);
  });
});
