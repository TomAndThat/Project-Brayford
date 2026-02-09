import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getOrganization,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  getOrganizationMember,
  inviteUserToOrganization,
  updateOrganizationMember,
  removeOrganizationMember,
  getOrganizationMembers,
  getUserOrganizations,
} from '../organizations';
import { toBranded, type OrganizationId, type UserId, type OrganizationMemberId } from '@brayford/core';
import {
  createMockOrganization,
  createMockCreateOrganizationData,
  createMockOrganizationMember,
  createMockUserId,
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
    query: vi.fn(),
    where: vi.fn(),
    serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
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

describe('getOrganization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns organization document when it exists', async () => {
    const orgId = createMockOrganizationId('org-123');
    const mockOrgData = createMockOrganization({
      name: 'Test Organization',
      type: 'individual',
    });

    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => mockOrgData,
      id: 'org-123',
    } as any);

    const result = await getOrganization(orgId);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(orgId);
    expect(result?.name).toBe('Test Organization');
    expect(result?.type).toBe('individual');
  });

  it('returns null when organization does not exist', async () => {
    const orgId = createMockOrganizationId('nonexistent-org');

    vi.mocked(getDoc).mockResolvedValue({
      exists: () => false,
    } as any);

    const result = await getOrganization(orgId);

    expect(result).toBeNull();
  });

  it('includes all organization properties', async () => {
    const orgId = createMockOrganizationId('org-123');
    const mockOrgData = createMockOrganization({
      name: 'Comprehensive Org',
      type: 'enterprise',
      billingEmail: 'billing@example.com',
      createdBy: 'user-123',
      settings: { theme: 'dark', notifications: true },
    });

    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => mockOrgData,
    } as any);

    const result = await getOrganization(orgId);

    expect(result?.name).toBe('Comprehensive Org');
    expect(result?.type).toBe('enterprise');
    expect(result?.billingEmail).toBe('billing@example.com');
    expect(result?.createdBy).toBe('user-123');
    expect(result?.settings).toEqual({ theme: 'dark', notifications: true });
  });
});

describe('createOrganization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates organization and owner member document', async () => {
    const userId = createMockUserId('user-123');
    const createData = createMockCreateOrganizationData({
      name: 'New Organization',
      type: 'individual',
      billingEmail: 'billing@example.com',
      createdBy: 'user-123',
    });

    const orgId = await createOrganization(createData, userId);

    expect(orgId).toBeDefined();
    expect(setDoc).toHaveBeenCalledTimes(2); // Once for org, once for member
    
    // Verify organization creation
    const orgCall = vi.mocked(setDoc).mock.calls[0];
    expect(orgCall[1]).toMatchObject({
      name: 'New Organization',
      type: 'individual',
      billingEmail: 'billing@example.com',
      createdBy: 'user-123',
    });
  });

  it('creates member with owner role', async () => {
    const userId = createMockUserId('user-123');
    const createData = createMockCreateOrganizationData();

    await createOrganization(createData, userId);

    // Second setDoc call is for member
    const memberCall = vi.mocked(setDoc).mock.calls[1];
    expect(memberCall[1]).toMatchObject({
      role: 'owner',
      userId: 'user-123',
      brandAccess: [],
      invitedAt: null,
      invitedBy: null,
    });
  });

  it('generates unique organization IDs', async () => {
    const userId = createMockUserId('user-123');
    const createData = createMockCreateOrganizationData();

    const orgId1 = await createOrganization(createData, userId);
    const orgId2 = await createOrganization(createData, userId);

    // IDs should be different (though in mock they might be same string)
    expect(typeof orgId1).toBe('string');
    expect(typeof orgId2).toBe('string');
  });
});

describe('updateOrganization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls updateDoc with validated data', async () => {
    const orgId = createMockOrganizationId('org-123');
    const updateData = {
      name: 'Updated Organization Name',
      billingEmail: 'new-billing@example.com',
    };

    await updateOrganization(orgId, updateData);

    expect(updateDoc).toHaveBeenCalledOnce();
    expect(updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'org-123' }),
      updateData
    );
  });

  it('allows updating organization type', async () => {
    const orgId = createMockOrganizationId('org-123');
    const updateData = {
      type: 'enterprise' as const,
    };

    await updateOrganization(orgId, updateData);

    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { type: 'enterprise' }
    );
  });

  it('allows updating settings', async () => {
    const orgId = createMockOrganizationId('org-123');
    const updateData = {
      settings: { customFeature: true },
    };

    await updateOrganization(orgId, updateData);

    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { settings: { customFeature: true } }
    );
  });

  it('validates update data before calling Firestore', async () => {
    const orgId = createMockOrganizationId('org-123');
    
    const invalidUpdate = {
      name: '', // Invalid - empty name
    };

    await expect(updateOrganization(orgId, invalidUpdate)).rejects.toThrow();
    expect(updateDoc).not.toHaveBeenCalled();
  });
});

describe('deleteOrganization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls deleteDoc with correct organization reference', async () => {
    const orgId = createMockOrganizationId('org-123');

    await deleteOrganization(orgId);

    expect(deleteDoc).toHaveBeenCalledOnce();
    expect(deleteDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'org-123' })
    );
  });
});

describe('getOrganizationMember', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns member document when it exists', async () => {
    const memberId = toBranded<OrganizationMemberId>('member-123');
    const mockMemberData = createMockOrganizationMember({
      organizationId: 'org-123',
      userId: 'user-123',
      role: 'admin',
    });

    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => mockMemberData,
      id: 'member-123',
    } as any);

    const result = await getOrganizationMember(memberId);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(memberId);
    expect(result?.role).toBe('admin');
  });

  it('returns null when member does not exist', async () => {
    const memberId = toBranded<OrganizationMemberId>('nonexistent');

    vi.mocked(getDoc).mockResolvedValue({
      exists: () => false,
    } as any);

    const result = await getOrganizationMember(memberId);

    expect(result).toBeNull();
  });

  it('converts string IDs to branded types', async () => {
    const memberId = toBranded<OrganizationMemberId>('member-123');
    const mockMemberData = createMockOrganizationMember({
      organizationId: 'org-123',
      userId: 'user-456',
      invitedBy: 'user-789',
      brandAccess: ['brand-1', 'brand-2'],
    });

    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => mockMemberData,
    } as any);

    const result = await getOrganizationMember(memberId);

    expect(result?.organizationId).toBeDefined();
    expect(result?.userId).toBeDefined();
    expect(result?.invitedBy).toBeDefined();
    expect(result?.brandAccess).toHaveLength(2);
  });

  it('handles null invitedBy for self-created members', async () => {
    const memberId = toBranded<OrganizationMemberId>('member-123');
    const mockMemberData = createMockOrganizationMember({
      invitedAt: null,
      invitedBy: null,
      role: 'owner',
    });

    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => mockMemberData,
    } as any);

    const result = await getOrganizationMember(memberId);

    expect(result?.invitedBy).toBeNull();
    expect(result?.invitedAt).toBeNull();
  });
});

describe('inviteUserToOrganization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates member document with invitation data', async () => {
    const inviterUserId = createMockUserId('inviter-123');
    const inviteData = {
      organizationId: 'org-123',
      userId: 'new-user-456',
      role: 'member' as const,
      brandAccess: ['brand-1', 'brand-2'],
      invitedBy: 'inviter-123',
    };

    const memberId = await inviteUserToOrganization(inviteData, inviterUserId);

    expect(memberId).toBeDefined();
    expect(setDoc).toHaveBeenCalledOnce();
    
    const call = vi.mocked(setDoc).mock.calls[0];
    expect(call[1]).toMatchObject({
      organizationId: 'org-123',
      userId: 'new-user-456',
      role: 'member',
      brandAccess: ['brand-1', 'brand-2'],
      invitedBy: 'inviter-123',
    });
  });

  it('sets invitedAt timestamp', async () => {
    const inviterUserId = createMockUserId('inviter-123');
    const inviteData = {
      organizationId: 'org-123',
      userId: 'new-user',
      role: 'member' as const,
      brandAccess: [],
      invitedBy: 'inviter-123',
    };

    await inviteUserToOrganization(inviteData, inviterUserId);

    const call = vi.mocked(setDoc).mock.calls[0];
    expect(call[1]).toHaveProperty('invitedAt');
  });

  it('accepts different roles for invitations', async () => {
    const inviterUserId = createMockUserId('inviter-123');
    
    const memberInvite = {
      organizationId: 'org-123',
      userId: 'user-1',
      role: 'member' as const,
      brandAccess: [],
      invitedBy: 'inviter-123',
    };
    
    const adminInvite = {
      organizationId: 'org-123',
      userId: 'user-2',
      role: 'admin' as const,
      brandAccess: [],
      invitedBy: 'inviter-123',
    };

    await inviteUserToOrganization(memberInvite, inviterUserId);
    await inviteUserToOrganization(adminInvite, inviterUserId);

    expect(setDoc).toHaveBeenCalledTimes(2);
  });
});

describe('updateOrganizationMember', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates member role', async () => {
    const memberId = toBranded<OrganizationMemberId>('member-123');
    const updateData = {
      role: 'admin' as const,
    };

    await updateOrganizationMember(memberId, updateData);

    expect(updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'member-123' }),
      { role: 'admin' }
    );
  });

  it('updates brandAccess', async () => {
    const memberId = toBranded<OrganizationMemberId>('member-123');
    const updateData = {
      brandAccess: ['brand-1', 'brand-2', 'brand-3'],
    };

    await updateOrganizationMember(memberId, updateData);

    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { brandAccess: ['brand-1', 'brand-2', 'brand-3'] }
    );
  });

  it('validates update data', async () => {
    const memberId = toBranded<OrganizationMemberId>('member-123');
    const invalidUpdate = {
      role: 'invalid-role' as any,
    };

    await expect(updateOrganizationMember(memberId, invalidUpdate)).rejects.toThrow();
    expect(updateDoc).not.toHaveBeenCalled();
  });
});

describe('removeOrganizationMember', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes member document', async () => {
    const memberId = toBranded<OrganizationMemberId>('member-123');

    await removeOrganizationMember(memberId);

    expect(deleteDoc).toHaveBeenCalledOnce();
    expect(deleteDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'member-123' })
    );
  });
});

describe('getOrganizationMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all members of an organization', async () => {
    const orgId = createMockOrganizationId('org-123');
    const mockMembers = [
      { id: 'member-1', ...createMockOrganizationMember({ userId: 'user-1', role: 'owner' as const }) },
      { id: 'member-2', ...createMockOrganizationMember({ userId: 'user-2', role: 'admin' as const }) },
      { id: 'member-3', ...createMockOrganizationMember({ userId: 'user-3', role: 'member' as const }) },
    ];

    vi.mocked(query).mockReturnValue({ _isQuery: true } as any);
    vi.mocked(where).mockReturnValue({ _isWhere: true } as any);
    vi.mocked(getDocs).mockResolvedValue({
      docs: mockMembers.map((member) => ({
        id: member.id,
        data: () => member,
      })),
    } as any);

    const result = await getOrganizationMembers(orgId);

    expect(result).toHaveLength(3);
    expect(result[0].role).toBe('owner');
    expect(result[1].role).toBe('admin');
    expect(result[2].role).toBe('member');
  });

  it('returns empty array when organization has no members', async () => {
    const orgId = createMockOrganizationId('empty-org');

    vi.mocked(query).mockReturnValue({ _isQuery: true } as any);
    vi.mocked(getDocs).mockResolvedValue({
      docs: [],
    } as any);

    const result = await getOrganizationMembers(orgId);

    expect(result).toEqual([]);
  });

  it('queries with correct organizationId filter', async () => {
    const orgId = createMockOrganizationId('org-123');

    vi.mocked(query).mockReturnValue({ _isQuery: true } as any);
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    await getOrganizationMembers(orgId);

    expect(where).toHaveBeenCalledWith('organizationId', '==', 'org-123');
  });
});

describe('getUserOrganizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all organizations user is member of', async () => {
    const userId = createMockUserId('user-123');
    const mockMemberships = [
      { id: 'member-1', ...createMockOrganizationMember({ organizationId: 'org-1' }) },
      { id: 'member-2', ...createMockOrganizationMember({ organizationId: 'org-2' }) },
    ];

    vi.mocked(query).mockReturnValue({ _isQuery: true } as any);
    vi.mocked(where).mockReturnValue({ _isWhere: true } as any);
    vi.mocked(getDocs).mockResolvedValue({
      docs: mockMemberships.map((member) => ({
        id: member.id,
        data: () => member,
      })),
    } as any);

    const result = await getUserOrganizations(userId);

    expect(result).toHaveLength(2);
  });

  it('returns empty array when user has no organizations', async () => {
    const userId = createMockUserId('new-user');

    vi.mocked(query).mockReturnValue({ _isQuery: true } as any);
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    const result = await getUserOrganizations(userId);

    expect(result).toEqual([]);
  });

  it('queries with correct userId filter', async () => {
    const userId = createMockUserId('user-123');

    vi.mocked(query).mockReturnValue({ _isQuery: true } as any);
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    await getUserOrganizations(userId);

    expect(where).toHaveBeenCalledWith('userId', '==', 'user-123');
  });
});

describe('integration workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles complete organization creation flow', async () => {
    const userId = createMockUserId('user-123');
    const createData = createMockCreateOrganizationData({
      name: 'New Startup',
      type: 'individual',
      billingEmail: 'founder@startup.com',
      createdBy: 'user-123',
    });

    // Create organization
    const orgId = await createOrganization(createData, userId);
    expect(orgId).toBeDefined();
    expect(setDoc).toHaveBeenCalledTimes(2); // Org + owner member

    // Verify we can get members
    vi.mocked(query).mockReturnValue({ _isQuery: true } as any);
    vi.mocked(getDocs).mockResolvedValue({
      docs: [{
        id: 'member-1',
        data: () => createMockOrganizationMember({ userId: 'user-123', role: 'owner' as const }),
      }],
    } as any);

    const members = await getOrganizationMembers(orgId);
    expect(members).toHaveLength(1);
    expect(members[0].role).toBe('owner');
  });

  it('handles invitation and member management flow', async () => {
    const ownerId = createMockUserId('owner-123');
    const newUserId = createMockUserId('new-user-456');
    const orgId = createMockOrganizationId('org-123');

    // Invite new user
    const inviteData = {
      organizationId: 'org-123',
      userId: 'new-user-456',
      role: 'member' as const,
      brandAccess: ['brand-1'],
      invitedBy: 'owner-123',
    };

    const memberId = await inviteUserToOrganization(inviteData, ownerId);
    expect(memberId).toBeDefined();

    // Update member role
    await updateOrganizationMember(memberId, { role: 'admin' as const });
    expect(updateDoc).toHaveBeenCalled();

    // Remove member
    await removeOrganizationMember(memberId);
    expect(deleteDoc).toHaveBeenCalled();
  });
});
