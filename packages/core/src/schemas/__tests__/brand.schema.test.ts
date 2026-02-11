import { describe, it, expect } from 'vitest';
import {
  BrandSchema,
  CreateBrandSchema,
  UpdateBrandSchema,
  validateBrandData,
  validateCreateBrandData,
  validateUpdateBrandData,
} from '../brand.schema';
import { createMockBrand, createMockCreateBrandData } from "../../__tests__/helpers/test-factories";
import { ZodError } from 'zod';

describe('BrandSchema', () => {
  describe('validation success cases', () => {
    it('validates a complete valid brand', () => {
      const validBrand = createMockBrand();
      const result = BrandSchema.parse(validBrand);
      
      expect(result).toEqual(validBrand);
      expect(result.name).toBe('Test Brand');
      expect(result.isActive).toBe(true);
    });

    it('defaults isActive to true if not provided', () => {
      const brand = createMockBrand();
      delete (brand as any).isActive;
      
      const result = BrandSchema.parse(brand);
      expect(result.isActive).toBe(true);
    });

    it('accepts isActive as false', () => {
      const brand = createMockBrand({ isActive: false });
      const result = BrandSchema.parse(brand);
      
      expect(result.isActive).toBe(false);
    });
  });

  describe('validation failure cases', () => {
    it('rejects missing required fields', () => {
      const requiredFields = ['organizationId', 'name', 'createdAt'];

      requiredFields.forEach((field) => {
        const brand = createMockBrand();
        delete (brand as any)[field];
        
        expect(() => BrandSchema.parse(brand)).toThrow(ZodError);
      });
    });

    it('rejects empty brand name', () => {
      const brand = createMockBrand({ name: '' });
      expect(() => BrandSchema.parse(brand)).toThrow(ZodError);
    });

    it('rejects brand name exceeding 100 characters', () => {
      const brand = createMockBrand({ name: 'a'.repeat(101) });
      expect(() => BrandSchema.parse(brand)).toThrow(ZodError);
    });

    it('rejects non-boolean isActive', () => {
      const brand = { ...createMockBrand(), isActive: 'yes' };
      expect(() => BrandSchema.parse(brand)).toThrow(ZodError);
    });

    it('rejects non-Date createdAt', () => {
      const brand = { ...createMockBrand(), createdAt: '2024-01-01' };
      expect(() => BrandSchema.parse(brand)).toThrow(ZodError);
    });
  });
});

describe('CreateBrandSchema', () => {
  it('validates brand creation data without timestamps and isActive', () => {
    const createData = createMockCreateBrandData();
    const result = CreateBrandSchema.parse(createData);
    
    expect(result).toEqual(createData);
    expect(result).not.toHaveProperty('createdAt');
    expect(result).not.toHaveProperty('isActive');
  });

  it('omits createdAt and isActive if provided', () => {
    const createData = {
      ...createMockCreateBrandData(),
      createdAt: new Date(),
      isActive: true,
    };

    const result = CreateBrandSchema.parse(createData);
    expect(result).not.toHaveProperty('createdAt');
    expect(result).not.toHaveProperty('isActive');
  });

  it('requires organizationId', () => {
    const createData = createMockCreateBrandData();
    delete (createData as any).organizationId;
    
    expect(() => CreateBrandSchema.parse(createData)).toThrow(ZodError);
  });

  it('requires name', () => {
    const createData = createMockCreateBrandData();
    delete (createData as any).name;
    
    expect(() => CreateBrandSchema.parse(createData)).toThrow(ZodError);
  });
});

describe('UpdateBrandSchema', () => {
  it('allows partial updates with only specified fields', () => {
    const updates = {
      name: 'Updated Brand Name',
    };

    const result = UpdateBrandSchema.parse(updates);
    expect(result.name).toBe('Updated Brand Name');
  });

  it('allows updating isActive', () => {
    const updates = {
      isActive: false,
    };

    const result = UpdateBrandSchema.parse(updates);
    expect(result.isActive).toBe(false);
  });

  it('prevents updating immutable fields', () => {
    const updates = {
      organizationId: 'different-org-id',
      createdAt: new Date(),
    };

    const result = UpdateBrandSchema.parse(updates);
    expect(result).not.toHaveProperty('organizationId');
    expect(result).not.toHaveProperty('createdAt');
  });

  it('validates types of provided fields', () => {
    expect(() => UpdateBrandSchema.parse({ name: '' })).toThrow(ZodError);
    expect(() => UpdateBrandSchema.parse({ isActive: 'yes' })).toThrow(ZodError);
  });

  it('accepts empty update object', () => {
    const result = UpdateBrandSchema.parse({});
    expect(result).toEqual({});
  });

  it('allows multiple fields to be updated simultaneously', () => {
    const updates = {
      name: 'New Name',
      isActive: false,
    };

    const result = UpdateBrandSchema.parse(updates);
    expect(result.name).toBe('New Name');
    expect(result.isActive).toBe(false);
  });
});

describe('validateBrandData', () => {
  it('returns validated Brand object for valid data', () => {
    const validBrand = createMockBrand();
    const result = validateBrandData(validBrand);
    
    expect(result).toEqual(validBrand);
  });

  it('throws ZodError for invalid data', () => {
    expect(() => validateBrandData({ invalid: 'data' })).toThrow(ZodError);
    expect(() => validateBrandData(null)).toThrow(ZodError);
    expect(() => validateBrandData(undefined)).toThrow(ZodError);
    expect(() => validateBrandData('not an object')).toThrow(ZodError);
  });

  it('provides detailed error messages for invalid data', () => {
    try {
      validateBrandData({ name: 'Brand', organizationId: '123' });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError);
      const zodError = error as ZodError;
      expect(zodError.issues.length).toBeGreaterThan(0);
    }
  });
});

describe('validateCreateBrandData', () => {
  it('returns validated CreateBrandData for valid data', () => {
    const createData = createMockCreateBrandData();
    const result = validateCreateBrandData(createData);
    
    expect(result).toEqual(createData);
  });

  it('throws ZodError for invalid data', () => {
    expect(() => validateCreateBrandData({ name: 'Brand' })).toThrow(ZodError);
    expect(() => validateCreateBrandData({})).toThrow(ZodError);
  });

  it('requires all mandatory fields', () => {
    try {
      validateCreateBrandData({
        organizationId: 'org-123',
        // missing name
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError);
    }
  });
});

describe('validateUpdateBrandData', () => {
  it('returns validated UpdateBrandData for valid data', () => {
    const updateData = { name: 'New Brand Name' };
    const result = validateUpdateBrandData(updateData);
    
    expect(result).toEqual(updateData);
  });

  it('throws ZodError for invalid data', () => {
    expect(() => validateUpdateBrandData({ name: '' })).toThrow(ZodError);
    expect(() => validateUpdateBrandData({ isActive: 123 })).toThrow(ZodError);
  });

  it('accepts empty update object', () => {
    const result = validateUpdateBrandData({});
    expect(result).toEqual({});
  });

  it('validates each field independently', () => {
    // Valid name update
    expect(() => validateUpdateBrandData({ name: 'Valid Name' })).not.toThrow();
    
    // Invalid name update
    expect(() => validateUpdateBrandData({ name: '' })).toThrow(ZodError);
    
    // Valid isActive update
    expect(() => validateUpdateBrandData({ isActive: false })).not.toThrow();
    
    // Invalid isActive update
    expect(() => validateUpdateBrandData({ isActive: 'not a boolean' })).toThrow(ZodError);
  });
});
