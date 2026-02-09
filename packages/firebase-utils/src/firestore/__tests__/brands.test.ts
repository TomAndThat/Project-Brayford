import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getBrand,
  createBrand,
  updateBrand,
  deleteBrand,
  permanentlyDeleteBrand,
  getOrganizationBrands,
  brandExists,
} from '../brands';
import { toBranded, type BrandId, type OrganizationId } from '@brayford/core';
import {
  createMockBrand,
  createMockCreateBrandData,
  createMockBrandId,
  createMockOrganizationId,
} from '@brayford/core/test-helpers';

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => {
  const mockDoc = (_db: any, collection: string, id?: string) => {
    const docRef = { collection, id: id || 'generated-id', _isDoc: true };
    docRef.withConverter = vi.fn(() => docRef);
    return docRef;
  };
  
  const mockCollection = (_db: any, name: string) => {
    const collectionRef = { name, _isCollection: true };
    collectionRef.withConverter = vi.fn(() => collectionRef);
    return collectionRef;
  };
  
  // Mock Timestamp class
  class MockTimestamp {
    seconds: number;
    nanoseconds: number;
    
    constructor(seconds: number, nanoseconds: number) {
      this.seconds = seconds;
      this.nanoseconds = nanoseconds;
    }
    
    toDate() {
      return new Date(this.seconds * 1000 + this.nanoseconds / 1000000);
    }
  }
  
  return {
    doc: vi.fn(mockDoc),
    collection: vi.fn(mockCollection),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    query: vi.fn((...args) => ({ _isQuery: true, args })),
    where: vi.fn((field, op, value) => ({ _isWhere: true, field, op, value })),
    serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
    arrayUnion: vi.fn((...elements) => ({ _arrayUnion: true, elements })),
    Timestamp: MockTimestamp,
  };
});

// Mock Firebase config
vi.mock('../../config', () => ({
  db: { _isFirestore: true },
  auth: {},
  firebaseApp: {},
}));

import { getDoc, getDocs, setDoc, updateDoc, deleteDoc, doc, collection, query, where } from 'firebase/firestore';

describe('getBrand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns brand document when it exists', async () => {
    const brandId = createMockBrandId('brand-123');
    const mockBrandData = createMockBrand({
      name: 'Test Brand',
      organizationId: 'org-123',
    });

    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => mockBrandData,
      id: 'brand-123',
    } as any);

    const result = await getBrand(brandId);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(brandId);
    expect(result?.name).toBe('Test Brand');
  });

  it('returns null when brand does not exist', async () => {
    const brandId = createMockBrandId('nonexistent-brand');

    vi.mocked(getDoc).mockResolvedValue({
      exists: () => false,
    } as any);

    const result = await getBrand(brandId);

    expect(result).toBeNull();
  });

  it('includes all brand properties', async () => {
    const brandId = createMockBrandId('brand-123');
    const mockBrandData = createMockBrand({
      organizationId: 'org-123',
      name: 'Complete Brand',
      logo: 'https://example.com/logo.png',
      description: 'A comprehensive brand',
      isActive: true,
    });

    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => mockBrandData,
    } as any);

    const result = await getBrand(brandId);

    expect(result?.name).toBe('Complete Brand');
    expect(result?.logo).toBe('https://example.com/logo.png');
    expect(result?.description).toBe('A comprehensive brand');
    expect(result?.isActive).toBe(true);
  });

  it('converts organizationId to branded type', async () => {
    const brandId = createMockBrandId('brand-123');
    const mockBrandData = createMockBrand({
      organizationId: 'org-456',
    });

    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => mockBrandData,
    } as any);

    const result = await getBrand(brandId);

    expect(result?.organizationId).toBeDefined();
    // Branded type check - if TypeScript compiles, the type is correct
    const orgId: OrganizationId = result!.organizationId;
    expect(orgId).toBeTruthy();
  });

  it('handles brand with null logo', async () => {
    const brandId = createMockBrandId('brand-123');
    const mockBrandData = createMockBrand({
      logo: null,
    });

    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => mockBrandData,
    } as any);

    const result = await getBrand(brandId);

    expect(result?.logo).toBeNull();
  });
});

describe('createBrand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Auto-grant queries organizationMembers — default to empty result
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);
  });

  it('creates brand document and returns ID', async () => {
    const createData = createMockCreateBrandData({
      organizationId: 'org-123',
      name: 'New Brand',
      logo: 'https://example.com/logo.png',
      description: 'A new brand',
    });

    const brandId = await createBrand(createData);

    expect(brandId).toBeDefined();
    expect(setDoc).toHaveBeenCalledOnce();
    
    const call = vi.mocked(setDoc).mock.calls[0];
    expect(call[1]).toMatchObject({
      organizationId: 'org-123',
      name: 'New Brand',
      logo: 'https://example.com/logo.png',
      description: 'A new brand',
      isActive: true,
    });
  });

  it('sets isActive to true by default', async () => {
    const createData = createMockCreateBrandData();

    await createBrand(createData);

    const call = vi.mocked(setDoc).mock.calls[0];
    expect(call[1]).toHaveProperty('isActive', true);
  });

  it('sets createdAt timestamp', async () => {
    const createData = createMockCreateBrandData();

    await createBrand(createData);

    const call = vi.mocked(setDoc).mock.calls[0];
    expect(call[1]).toHaveProperty('createdAt');
  });

  it('accepts brand with null logo', async () => {
    const createData = createMockCreateBrandData({
      logo: null,
    });

    await createBrand(createData);

    const call = vi.mocked(setDoc).mock.calls[0];
    expect(call[1].logo).toBeNull();
  });

  it('accepts brand without description', async () => {
    const createData = createMockCreateBrandData();
    delete createData.description;

    await createBrand(createData);

    const call = vi.mocked(setDoc).mock.calls[0];
    expect(call[1]).not.toHaveProperty('description');
  });
});

describe('updateBrand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls updateDoc with validated data', async () => {
    const brandId = createMockBrandId('brand-123');
    const updateData = {
      name: 'Updated Brand Name',
      logo: 'https://new-logo.example.com/logo.png',
    };

    await updateBrand(brandId, updateData);

    expect(updateDoc).toHaveBeenCalledOnce();
    expect(updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'brand-123' }),
      updateData
    );
  });

  it('allows partial updates with single field', async () => {
    const brandId = createMockBrandId('brand-123');

    await updateBrand(brandId, { name: 'New Name Only' });

    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { name: 'New Name Only' }
    );
  });

  it('allows updating isActive flag', async () => {
    const brandId = createMockBrandId('brand-123');

    await updateBrand(brandId, { isActive: false });

    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { isActive: false }
    );
  });

  it('allows setting logo to null', async () => {
    const brandId = createMockBrandId('brand-123');

    await updateBrand(brandId, { logo: null });

    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { logo: null }
    );
  });

  it('allows updating description', async () => {
    const brandId = createMockBrandId('brand-123');

    await updateBrand(brandId, { description: 'Updated description' });

    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { description: 'Updated description' }
    );
  });

  it('validates update data before calling Firestore', async () => {
    const brandId = createMockBrandId('brand-123');
    
    const invalidUpdate = {
      name: '', // Invalid - empty name
    };

    await expect(updateBrand(brandId, invalidUpdate)).rejects.toThrow();
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('handles multiple field updates', async () => {
    const brandId = createMockBrandId('brand-123');
    const updateData = {
      name: 'New Name',
      description: 'New description',
      logo: 'https://new-logo.com/logo.png',
      isActive: true,
    };

    await updateBrand(brandId, updateData);

    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      updateData
    );
  });
});

describe('deleteBrand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('performs soft delete by setting isActive to false', async () => {
    const brandId = createMockBrandId('brand-123');

    await deleteBrand(brandId);

    expect(updateDoc).toHaveBeenCalledOnce();
    expect(updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'brand-123' }),
      { isActive: false }
    );
  });

  it('does not call deleteDoc for soft delete', async () => {
    const brandId = createMockBrandId('brand-123');

    await deleteBrand(brandId);

    expect(deleteDoc).not.toHaveBeenCalled();
    expect(updateDoc).toHaveBeenCalled();
  });
});

describe('permanentlyDeleteBrand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls deleteDoc to permanently remove brand', async () => {
    const brandId = createMockBrandId('brand-123');

    await permanentlyDeleteBrand(brandId);

    expect(deleteDoc).toHaveBeenCalledOnce();
    expect(deleteDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'brand-123' })
    );
  });

  it('does not call updateDoc for permanent deletion', async () => {
    const brandId = createMockBrandId('brand-123');

    await permanentlyDeleteBrand(brandId);

    expect(updateDoc).not.toHaveBeenCalled();
    expect(deleteDoc).toHaveBeenCalled();
  });
});

describe('getOrganizationBrands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all active brands by default', async () => {
    const orgId = createMockOrganizationId('org-123');
    const mockBrands = [
      { id: 'brand-1', ...createMockBrand({ name: 'Brand 1', isActive: true }) },
      { id: 'brand-2', ...createMockBrand({ name: 'Brand 2', isActive: true }) },
    ];

    vi.mocked(query).mockReturnValue({ _isQuery: true } as any);
    vi.mocked(where).mockReturnValue({ _isWhere: true } as any);
    vi.mocked(getDocs).mockResolvedValue({
      docs: mockBrands.map((brand) => ({
        id: brand.id,
        data: () => brand,
      })),
    } as any);

    const result = await getOrganizationBrands(orgId);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Brand 1');
    expect(result[1].name).toBe('Brand 2');
  });

  it('filters to only active brands when activeOnly is true', async () => {
    const orgId = createMockOrganizationId('org-123');

    vi.mocked(query).mockReturnValue({ _isQuery: true } as any);
    vi.mocked(where).mockReturnValue({ _isWhere: true } as any);
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    await getOrganizationBrands(orgId, true);

    // Should have two where clauses: organizationId and isActive
    expect(where).toHaveBeenCalledWith('organizationId', '==', 'org-123');
    expect(where).toHaveBeenCalledWith('isActive', '==', true);
  });

  it('includes inactive brands when activeOnly is false', async () => {
    const orgId = createMockOrganizationId('org-123');
    const mockBrands = [
      { id: 'brand-1', ...createMockBrand({ isActive: true }) },
      { id: 'brand-2', ...createMockBrand({ isActive: false }) },
    ];

    vi.mocked(query).mockReturnValue({ _isQuery: true } as any);
    vi.mocked(where).mockReturnValue({ _isWhere: true } as any);
    vi.mocked(getDocs).mockResolvedValue({
      docs: mockBrands.map((brand) => ({
        id: brand.id,
        data: () => brand,
      })),
    } as any);

    const result = await getOrganizationBrands(orgId, false);

    expect(result).toHaveLength(2);
    
    // When activeOnly is false, should only filter by organizationId
    const whereCalls = vi.mocked(where).mock.calls;
    expect(whereCalls.some(call => call[0] === 'organizationId')).toBe(true);
  });

  it('returns empty array when organization has no brands', async () => {
    const orgId = createMockOrganizationId('empty-org');

    vi.mocked(query).mockReturnValue({ _isQuery: true } as any);
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    const result = await getOrganizationBrands(orgId);

    expect(result).toEqual([]);
  });

  it('converts string IDs to branded types', async () => {
    const orgId = createMockOrganizationId('org-123');
    const mockBrands = [
      { id: 'brand-1', ...createMockBrand({ organizationId: 'org-123' }) },
    ];

    vi.mocked(query).mockReturnValue({ _isQuery: true } as any);
    vi.mocked(where).mockReturnValue({ _isWhere: true } as any);
    vi.mocked(getDocs).mockResolvedValue({
      docs: mockBrands.map((brand) => ({
        id: brand.id,
        data: () => brand,
      })),
    } as any);

    const result = await getOrganizationBrands(orgId);

    expect(result[0].id).toBeDefined();
    expect(result[0].organizationId).toBeDefined();
    
    // Type check - if this compiles, branded types work
    const brandId: BrandId = result[0].id;
    const organizationId: OrganizationId = result[0].organizationId;
    expect(brandId).toBeTruthy();
    expect(organizationId).toBeTruthy();
  });
});

describe('brandExists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when brand exists', async () => {
    const brandId = createMockBrandId('existing-brand');

    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
    } as any);

    const result = await brandExists(brandId);

    expect(result).toBe(true);
    expect(getDoc).toHaveBeenCalledOnce();
  });

  it('returns false when brand does not exist', async () => {
    const brandId = createMockBrandId('nonexistent-brand');

    vi.mocked(getDoc).mockResolvedValue({
      exists: () => false,
    } as any);

    const result = await brandExists(brandId);

    expect(result).toBe(false);
    expect(getDoc).toHaveBeenCalledOnce();
  });

  it('checks existence for different brand IDs', async () => {
    const brandId1 = createMockBrandId('brand-1');
    const brandId2 = createMockBrandId('brand-2');

    vi.mocked(getDoc)
      .mockResolvedValueOnce({
        exists: () => true,
      } as any)
      .mockResolvedValueOnce({
        exists: () => false,
      } as any);

    expect(await brandExists(brandId1)).toBe(true);
    expect(await brandExists(brandId2)).toBe(false);
  });
});

describe('integration scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles brand lifecycle: create, update, soft delete', async () => {
    const createData = createMockCreateBrandData({
      organizationId: 'org-123',
      name: 'Test Brand',
    });

    // Create brand
    const brandId = await createBrand(createData);
    expect(brandId).toBeDefined();
    expect(setDoc).toHaveBeenCalled();

    // Update brand
    await updateBrand(brandId, { name: 'Updated Brand' });
    expect(updateDoc).toHaveBeenCalled();

    // Soft delete
    await deleteBrand(brandId);
    const softDeleteCall = vi.mocked(updateDoc).mock.calls.find(
      call => (call[1] as any).isActive === false
    );
    expect(softDeleteCall).toBeDefined();
  });

  it('handles permanent deletion workflow', async () => {
    const brandId = createMockBrandId('brand-to-delete');

    // First soft delete
    await deleteBrand(brandId);
    expect(updateDoc).toHaveBeenCalled();

    // Then permanent delete
    await permanentlyDeleteBrand(brandId);
    expect(deleteDoc).toHaveBeenCalled();
  });

  it('handles organization with multiple brands', async () => {
    const orgId = createMockOrganizationId('multi-brand-org');
    
    // Create multiple brands
    const brand1Data = createMockCreateBrandData({ organizationId: 'multi-brand-org', name: 'Brand 1' });
    const brand2Data = createMockCreateBrandData({ organizationId: 'multi-brand-org', name: 'Brand 2' });
    const brand3Data = createMockCreateBrandData({ organizationId: 'multi-brand-org', name: 'Brand 3' });

    const brandId1 = await createBrand(brand1Data);
    const brandId2 = await createBrand(brand2Data);
    const brandId3 = await createBrand(brand3Data);

    expect(setDoc).toHaveBeenCalledTimes(3);

    // Soft delete one brand
    await deleteBrand(brandId2);

    // Mock getOrganizationBrands to return active brands only
    vi.mocked(query).mockReturnValue({ _isQuery: true } as any);
    vi.mocked(where).mockReturnValue({ _isWhere: true } as any);
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        { id: 'brand-1', data: () => createMockBrand({ name: 'Brand 1', isActive: true }) },
        { id: 'brand-3', data: () => createMockBrand({ name: 'Brand 3', isActive: true }) },
      ],
    } as any);

    const activeBrands = await getOrganizationBrands(orgId, true);
    expect(activeBrands).toHaveLength(2);
  });
});
