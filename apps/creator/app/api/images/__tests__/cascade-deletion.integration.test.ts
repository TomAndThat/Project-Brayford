/**
 * Integration tests for Image Cascade Deletion — Live Query Approach
 *
 * Tests the DELETE handler which performs live Firestore queries against actual
 * brand and scene documents to find image references, rather than relying on
 * the async-cached usageCount/usedBy fields.
 *
 * This is critical because the Cloud Function that updates usageCount runs
 * asynchronously and can be stale — a brand might reference an image but
 * usageCount could still be 0 if the function hasn't fired yet.
 *
 * These tests verify:
 * - Live brand queries detect references across all 4 styling image fields
 * - Live scene scans detect references in nested module configs
 * - Deduplication when the same brand appears in multiple field queries
 * - 409 Conflict response with accurate usedBy from live data
 * - Live event warnings for brands in active events
 * - Permission verification before cascade deletion
 * - Automatic cleanup of brand styling fields during cascade
 * - Automatic cleanup of scene module configs during cascade
 * - Correct 204 when no live references exist
 * - Edge cases: deleted brands, non-existent images
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE } from '../[imageId]/route';

// Mock Firebase Admin SDK
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => new Date()),
    arrayUnion: vi.fn((value) => ({ _type: 'arrayUnion', _value: value })),
    arrayRemove: vi.fn((value) => ({ _type: 'arrayRemove', _value: value })),
    increment: vi.fn((value) => ({ _type: 'increment', _value: value })),
  },
}));

vi.mock('firebase-admin/storage', () => ({
  getStorage: vi.fn(() => ({
    bucket: vi.fn(() => ({
      file: vi.fn(() => ({
        delete: vi.fn(),
      })),
    })),
  })),
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateRequest: vi.fn(),
}));

import { adminDb } from '@/lib/firebase-admin';
import { authenticateRequest } from '@/lib/api-auth';

// ===== Test Constants =====

const TEST_ORG_ID = 'org-123';
const TEST_USER_ID = 'user-123';
const TEST_IMAGE_ID = 'img-456';
const TEST_STORAGE_PATH = `images/${TEST_ORG_ID}/${TEST_IMAGE_ID}/photo.jpg`;

const BASE_IMAGE_DATA = {
  organizationId: TEST_ORG_ID,
  storagePath: TEST_STORAGE_PATH,
  name: 'Test Image',
  uploadStatus: 'completed',
};

const ADMIN_MEMBER = {
  organizationId: TEST_ORG_ID,
  userId: TEST_USER_ID,
  role: 'admin',
  permissions: ['images:delete', 'brands:update', 'events:manage_modules'],
  brandAccess: [],
};

const DELETE_ONLY_MEMBER = {
  organizationId: TEST_ORG_ID,
  userId: TEST_USER_ID,
  role: 'viewer',
  permissions: ['images:delete'],
  brandAccess: [],
};

// ===== Mock Setup Helper =====

interface TestConfig {
  imageExists?: boolean;
  imageData?: Record<string, unknown>;
  memberData?: Record<string, unknown>;
  memberExists?: boolean;
  /** Results for the 4 brand field queries: [profile, logo, banner, headerBackground] */
  brandFieldQueryResults?: Array<Array<{ id: string }>>;
  /** Scene documents returned by the organizationId query */
  sceneDocuments?: Array<{ id: string; data: Record<string, unknown> }>;
  /** Number of live events to return for the events query */
  liveEventsCount?: number;
  /** Brand document data, keyed by brandId — returned during cascade .doc(brandId).get() */
  brandDocs?: Record<string, Record<string, unknown>>;
  /** Scene document data, keyed by sceneId — returned during cascade .doc(sceneId).get() */
  sceneDocs?: Record<string, Record<string, unknown>>;
}

function createMockDocRef(exists: boolean, data?: Record<string, unknown>) {
  return {
    get: vi.fn().mockResolvedValue({
      exists,
      data: exists && data ? () => data : undefined,
    }),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

function setupTestMocks(config: TestConfig = {}) {
  const {
    imageExists = true,
    imageData = BASE_IMAGE_DATA,
    memberData = ADMIN_MEMBER,
    memberExists = true,
    brandFieldQueryResults = [[], [], [], []],
    sceneDocuments = [],
    liveEventsCount = 0,
    brandDocs = {},
    sceneDocs = {},
  } = config;

  // Track brand .get() calls for the 4 parallel field queries in findBrandReferencesLive
  let brandQueryIndex = 0;

  // Image document ref
  const mockImageRef = createMockDocRef(imageExists, imageData as Record<string, unknown>);

  // Brand document refs for cascade updates
  const mockBrandRefs: Record<string, ReturnType<typeof createMockDocRef>> = {};
  for (const [id, data] of Object.entries(brandDocs)) {
    mockBrandRefs[id] = createMockDocRef(true, data);
  }

  // Scene document refs for cascade updates
  const mockSceneRefs: Record<string, ReturnType<typeof createMockDocRef>> = {};
  for (const [id, data] of Object.entries(sceneDocs)) {
    mockSceneRefs[id] = createMockDocRef(true, data);
  }

  // Auth mock
  (authenticateRequest as any).mockResolvedValue({
    error: null,
    uid: TEST_USER_ID,
  });

  // Central collection mock — returns a fresh chainable object for each call
  (adminDb.collection as any).mockImplementation((collectionName: string) => {
    const chain: any = {};
    chain.where = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.select = vi.fn().mockReturnValue(chain);

    chain.doc = vi.fn((docId: string) => {
      if (collectionName === 'images') return mockImageRef;
      if (collectionName === 'brands') {
        return mockBrandRefs[docId] || createMockDocRef(false);
      }
      if (collectionName === 'scenes') {
        return mockSceneRefs[docId] || createMockDocRef(false);
      }
      return createMockDocRef(false);
    });

    chain.get = vi.fn(() => {
      if (collectionName === 'organizationMembers') {
        return Promise.resolve({
          docs: memberExists ? [{ data: () => memberData }] : [],
          empty: !memberExists,
        });
      }

      if (collectionName === 'brands') {
        const idx = brandQueryIndex++;
        const results = brandFieldQueryResults[idx] || [];
        return Promise.resolve({
          docs: results.map((r) => ({ id: r.id })),
          empty: results.length === 0,
          size: results.length,
        });
      }

      if (collectionName === 'scenes') {
        return Promise.resolve({
          docs: sceneDocuments.map((s) => ({
            id: s.id,
            data: () => s.data,
          })),
          empty: sceneDocuments.length === 0,
          size: sceneDocuments.length,
        });
      }

      if (collectionName === 'events') {
        return Promise.resolve({
          docs: Array(liveEventsCount).fill({ id: 'event-1' }),
          empty: liveEventsCount === 0,
          size: liveEventsCount,
        });
      }

      return Promise.resolve({ docs: [], empty: true, size: 0 });
    });

    return chain;
  });

  return { mockImageRef, mockBrandRefs, mockSceneRefs };
}

function makeDeleteRequest(imageId: string, force = false): NextRequest {
  const url = force
    ? `http://localhost:3000/api/images/${imageId}?force=true`
    : `http://localhost:3000/api/images/${imageId}`;
  return new NextRequest(url, { method: 'DELETE' });
}

// ===== Tests =====

describe('Image Cascade Deletion — Live Query Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Usage Detection via Live Queries', () => {
    it('should return 409 when brand references image, even if usageCount is 0 (stale cache)', async () => {
      // THIS IS THE EXACT BUG THAT WAS REPORTED:
      // usageCount was 0 but a brand was actually using the image as a profile image.
      // The old implementation skipped the cascade check entirely because usageCount was 0.
      setupTestMocks({
        imageData: {
          ...BASE_IMAGE_DATA,
          usageCount: 0,
          usedBy: { brands: [], scenes: [] },
        },
        brandFieldQueryResults: [
          [{ id: 'brand-1' }], // profileImageId matches
          [],                   // logoImageId — no match
          [],                   // bannerImageId — no match
          [],                   // headerBackgroundImageId — no match
        ],
      });

      const request = makeDeleteRequest(TEST_IMAGE_ID);
      const response = await DELETE(request, {
        params: Promise.resolve({ imageId: TEST_IMAGE_ID }),
      });

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toBe('This image is currently in use and cannot be deleted.');
      expect(data.usedBy.brands).toContain('brand-1');
    });

    it('should return 409 when scene references image via storage path in module config', async () => {
      setupTestMocks({
        sceneDocuments: [
          {
            id: 'scene-1',
            data: {
              modules: [
                {
                  type: 'image-display',
                  config: {
                    imageUrl: `https://storage.googleapis.com/bucket/o/${TEST_STORAGE_PATH}?alt=media`,
                    caption: 'Test',
                  },
                },
              ],
            },
          },
        ],
      });

      const request = makeDeleteRequest(TEST_IMAGE_ID);
      const response = await DELETE(request, {
        params: Promise.resolve({ imageId: TEST_IMAGE_ID }),
      });

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.usedBy.scenes).toContain('scene-1');
    });

    it('should deduplicate brands found across multiple styling field queries', async () => {
      setupTestMocks({
        brandFieldQueryResults: [
          [{ id: 'brand-1' }], // profileImageId
          [{ id: 'brand-2' }], // logoImageId
          [],                   // bannerImageId
          [{ id: 'brand-1' }], // headerBackgroundImageId — same brand, different field
        ],
      });

      const request = makeDeleteRequest(TEST_IMAGE_ID);
      const response = await DELETE(request, {
        params: Promise.resolve({ imageId: TEST_IMAGE_ID }),
      });

      expect(response.status).toBe(409);
      const data = await response.json();
      // brand-1 appeared in two queries but should be deduplicated
      expect(data.usedBy.brands).toHaveLength(2);
      expect(data.usedBy.brands).toContain('brand-1');
      expect(data.usedBy.brands).toContain('brand-2');
    });

    it('should include live event warnings when affected brands have live events', async () => {
      setupTestMocks({
        brandFieldQueryResults: [
          [{ id: 'brand-1' }],
          [],
          [],
          [],
        ],
        liveEventsCount: 1,
      });

      const request = makeDeleteRequest(TEST_IMAGE_ID);
      const response = await DELETE(request, {
        params: Promise.resolve({ imageId: TEST_IMAGE_ID }),
      });

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.liveEventWarnings).toBeDefined();
      expect(data.liveEventWarnings.length).toBeGreaterThan(0);
      expect(data.liveEventWarnings[0]).toContain('live event');
    });

    it('should delete image successfully (204) when no live references exist', async () => {
      const { mockImageRef } = setupTestMocks({
        brandFieldQueryResults: [[], [], [], []],
        sceneDocuments: [],
      });

      const request = makeDeleteRequest(TEST_IMAGE_ID);
      const response = await DELETE(request, {
        params: Promise.resolve({ imageId: TEST_IMAGE_ID }),
      });

      expect(response.status).toBe(204);
      expect(mockImageRef.delete).toHaveBeenCalled();
    });

    it('should ignore scenes that have modules without image references', async () => {
      const { mockImageRef } = setupTestMocks({
        sceneDocuments: [
          {
            id: 'scene-clean',
            data: {
              modules: [
                {
                  type: 'text',
                  config: { title: 'Hello', body: 'No image here' },
                },
              ],
            },
          },
        ],
      });

      const request = makeDeleteRequest(TEST_IMAGE_ID);
      const response = await DELETE(request, {
        params: Promise.resolve({ imageId: TEST_IMAGE_ID }),
      });

      expect(response.status).toBe(204);
      expect(mockImageRef.delete).toHaveBeenCalled();
    });
  });

  describe('Force Cascade Deletion', () => {
    it('should return 403 when user lacks brands:update permission for cascade', async () => {
      setupTestMocks({
        memberData: DELETE_ONLY_MEMBER,
        brandFieldQueryResults: [
          [{ id: 'brand-1' }],
          [],
          [],
          [],
        ],
      });

      const request = makeDeleteRequest(TEST_IMAGE_ID, true);
      const response = await DELETE(request, {
        params: Promise.resolve({ imageId: TEST_IMAGE_ID }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('brands');
    });

    it('should return 403 when user lacks events:manage_modules for scene cascade', async () => {
      setupTestMocks({
        memberData: DELETE_ONLY_MEMBER,
        sceneDocuments: [
          {
            id: 'scene-1',
            data: {
              modules: [
                {
                  type: 'image',
                  config: { url: `contains-${TEST_STORAGE_PATH}-in-value` },
                },
              ],
            },
          },
        ],
      });

      const request = makeDeleteRequest(TEST_IMAGE_ID, true);
      const response = await DELETE(request, {
        params: Promise.resolve({ imageId: TEST_IMAGE_ID }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('scenes');
    });

    it('should cascade delete: clear brand styling fields and delete image', async () => {
      const { mockImageRef, mockBrandRefs } = setupTestMocks({
        brandFieldQueryResults: [
          [{ id: 'brand-1' }], // profileImageId matches
          [],
          [],
          [],
        ],
        brandDocs: {
          'brand-1': {
            styling: {
              profileImageId: TEST_IMAGE_ID,
              profileImageUrl: 'https://storage/img.jpg',
              logoImageId: null,
              logoImageUrl: null,
            },
          },
        },
      });

      const request = makeDeleteRequest(TEST_IMAGE_ID, true);
      const response = await DELETE(request, {
        params: Promise.resolve({ imageId: TEST_IMAGE_ID }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.removed.brands).toBe(1);
      expect(data.removed.scenes).toBe(0);

      // Verify the correct styling fields were nullified
      expect(mockBrandRefs['brand-1']!.update).toHaveBeenCalledWith({
        'styling.profileImageId': null,
        'styling.profileImageUrl': null,
      });

      expect(mockImageRef.delete).toHaveBeenCalled();
    });

    it('should cascade delete: clear scene module configs and delete image', async () => {
      const { mockImageRef, mockSceneRefs } = setupTestMocks({
        sceneDocuments: [
          {
            id: 'scene-1',
            data: {
              modules: [
                {
                  type: 'image',
                  config: {
                    imageUrl: `https://storage.googleapis.com/bucket/o/${TEST_STORAGE_PATH}?alt=media`,
                  },
                },
              ],
            },
          },
        ],
        sceneDocs: {
          'scene-1': {
            modules: [
              {
                type: 'image',
                config: {
                  imageUrl: `https://storage.googleapis.com/bucket/o/${TEST_STORAGE_PATH}?alt=media`,
                },
              },
            ],
          },
        },
      });

      const request = makeDeleteRequest(TEST_IMAGE_ID, true);
      const response = await DELETE(request, {
        params: Promise.resolve({ imageId: TEST_IMAGE_ID }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.removed.scenes).toBe(1);

      // Verify the module config image URL was nullified
      expect(mockSceneRefs['scene-1']!.update).toHaveBeenCalledWith({
        modules: [
          {
            type: 'image',
            config: { imageUrl: null },
          },
        ],
      });

      expect(mockImageRef.delete).toHaveBeenCalled();
    });

    it('should delete with 204 when force=true but no references exist', async () => {
      const { mockImageRef } = setupTestMocks({
        brandFieldQueryResults: [[], [], [], []],
        sceneDocuments: [],
      });

      const request = makeDeleteRequest(TEST_IMAGE_ID, true);
      const response = await DELETE(request, {
        params: Promise.resolve({ imageId: TEST_IMAGE_ID }),
      });

      expect(response.status).toBe(204);
      expect(mockImageRef.delete).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should return 404 when image does not exist', async () => {
      setupTestMocks({ imageExists: false });

      const request = makeDeleteRequest(TEST_IMAGE_ID);
      const response = await DELETE(request, {
        params: Promise.resolve({ imageId: TEST_IMAGE_ID }),
      });

      expect(response.status).toBe(404);
    });

    it('should handle cascade gracefully when referenced brand no longer exists', async () => {
      const { mockImageRef } = setupTestMocks({
        brandFieldQueryResults: [
          [{ id: 'brand-deleted' }],
          [],
          [],
          [],
        ],
        brandDocs: {},
      });

      const request = makeDeleteRequest(TEST_IMAGE_ID, true);
      const response = await DELETE(request, {
        params: Promise.resolve({ imageId: TEST_IMAGE_ID }),
      });

      expect(response.status).toBe(200);
      expect(mockImageRef.delete).toHaveBeenCalled();
    });

    it('should skip scenes with no modules array during scan', async () => {
      const { mockImageRef } = setupTestMocks({
        sceneDocuments: [
          {
            id: 'scene-no-modules',
            data: {},
          },
        ],
      });

      const request = makeDeleteRequest(TEST_IMAGE_ID);
      const response = await DELETE(request, {
        params: Promise.resolve({ imageId: TEST_IMAGE_ID }),
      });

      expect(response.status).toBe(204);
      expect(mockImageRef.delete).toHaveBeenCalled();
    });

    it('should detect image references via imageId substring in scene configs', async () => {
      setupTestMocks({
        sceneDocuments: [
          {
            id: 'scene-2',
            data: {
              modules: [
                {
                  type: 'custom',
                  config: {
                    someField: `backdrop-${TEST_IMAGE_ID}-overlay`,
                  },
                },
              ],
            },
          },
        ],
      });

      const request = makeDeleteRequest(TEST_IMAGE_ID);
      const response = await DELETE(request, {
        params: Promise.resolve({ imageId: TEST_IMAGE_ID }),
      });

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.usedBy.scenes).toContain('scene-2');
    });
  });
});
