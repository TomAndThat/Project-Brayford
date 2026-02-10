/**
 * Permission System Tests
 */

import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  hasBrandAccess,
  requireBrandAccess,
  canModifyMemberRole,
  requireCanModifyMemberRole,
  canInviteRole,
  requireCanInviteRole,
  canChangeSelfRole,
  requireCanChangeSelfRole,
  getEffectivePermissions,
  getRoleDisplayName,
  getRoleDescription,
} from '../helpers';
import {
  USERS_INVITE,
  USERS_VIEW,
  USERS_REMOVE,
  BRANDS_CREATE,
  BRANDS_DELETE,
  ORG_DELETE,
  ORG_MANAGE_BILLING,
  EVENTS_CREATE,
} from '../constants';
import { getPermissionsForRole } from '../role-mappings';
import type { OrganizationMember } from '../../schemas/organization.schema';

// Test fixtures
const ownerMember: OrganizationMember = {
  organizationId: 'org123',
  userId: 'user123',
  role: 'owner',
  brandAccess: [],
  invitedAt: null,
  joinedAt: new Date('2024-01-01'),
  invitedBy: null,
};

const adminMember: OrganizationMember = {
  organizationId: 'org123',
  userId: 'user456',
  role: 'admin',
  brandAccess: [],
  invitedAt: new Date('2024-01-05'),
  joinedAt: new Date('2024-01-06'),
  invitedBy: 'user123',
};

const memberWithAccess: OrganizationMember = {
  organizationId: 'org123',
  userId: 'user789',
  role: 'member',
  brandAccess: ['brand_abc', 'brand_xyz'],
  invitedAt: new Date('2024-01-10'),
  joinedAt: new Date('2024-01-11'),
  invitedBy: 'user123',
};

const memberNoAccess: OrganizationMember = {
  organizationId: 'org123',
  userId: 'user999',
  role: 'member',
  brandAccess: [],
  invitedAt: new Date('2024-01-15'),
  joinedAt: new Date('2024-01-16'),
  invitedBy: 'user456',
};

describe('Permission System - Role Mappings', () => {
  it('should return owner permissions including wildcard', () => {
    const permissions = getPermissionsForRole('owner');
    expect(permissions).toContain('*');
  });

  it('should return admin permissions without billing access', () => {
    const permissions = getPermissionsForRole('admin');
    expect(permissions).toContain(USERS_INVITE);
    expect(permissions).toContain(BRANDS_CREATE);
    expect(permissions).not.toContain(ORG_MANAGE_BILLING);
    expect(permissions).not.toContain(ORG_DELETE);
  });

  it('should return limited member permissions', () => {
    const permissions = getPermissionsForRole('member');
    expect(permissions).toContain(USERS_VIEW);
    expect(permissions).toContain(EVENTS_CREATE);
    expect(permissions).not.toContain(USERS_INVITE);
    expect(permissions).not.toContain(BRANDS_CREATE);
  });
});

describe('Permission System - hasPermission', () => {
  it('should grant all permissions to owner', () => {
    expect(hasPermission(ownerMember, USERS_INVITE)).toBe(true);
    expect(hasPermission(ownerMember, BRANDS_DELETE)).toBe(true);
    expect(hasPermission(ownerMember, ORG_DELETE)).toBe(true);
    expect(hasPermission(ownerMember, ORG_MANAGE_BILLING)).toBe(true);
  });

  it('should grant admin permissions correctly', () => {
    expect(hasPermission(adminMember, USERS_INVITE)).toBe(true);
    expect(hasPermission(adminMember, BRANDS_CREATE)).toBe(true);
    expect(hasPermission(adminMember, BRANDS_DELETE)).toBe(true);
    expect(hasPermission(adminMember, ORG_MANAGE_BILLING)).toBe(false);
    expect(hasPermission(adminMember, ORG_DELETE)).toBe(false);
  });

  it('should grant member permissions correctly', () => {
    expect(hasPermission(memberWithAccess, USERS_VIEW)).toBe(true);
    expect(hasPermission(memberWithAccess, EVENTS_CREATE)).toBe(true);
    expect(hasPermission(memberWithAccess, USERS_INVITE)).toBe(false);
    expect(hasPermission(memberWithAccess, BRANDS_CREATE)).toBe(false);
    expect(hasPermission(memberWithAccess, ORG_DELETE)).toBe(false);
  });
});

describe('Permission System - hasAnyPermission', () => {
  it('should return true if member has at least one permission', () => {
    expect(
      hasAnyPermission(adminMember, [USERS_INVITE, ORG_DELETE])
    ).toBe(true);
    expect(
      hasAnyPermission(memberWithAccess, [EVENTS_CREATE, USERS_INVITE])
    ).toBe(true);
  });

  it('should return false if member has none of the permissions', () => {
    expect(
      hasAnyPermission(memberWithAccess, [USERS_INVITE, BRANDS_CREATE, ORG_DELETE])
    ).toBe(false);
  });
});

describe('Permission System - hasAllPermissions', () => {
  it('should return true if member has all permissions', () => {
    expect(
      hasAllPermissions(ownerMember, [USERS_INVITE, BRANDS_CREATE, ORG_DELETE])
    ).toBe(true);
    expect(
      hasAllPermissions(adminMember, [USERS_INVITE, BRANDS_CREATE])
    ).toBe(true);
  });

  it('should return false if member lacks any permission', () => {
    expect(
      hasAllPermissions(adminMember, [USERS_INVITE, ORG_DELETE])
    ).toBe(false);
    expect(
      hasAllPermissions(memberWithAccess, [EVENTS_CREATE, USERS_INVITE])
    ).toBe(false);
  });
});

describe('Permission System - requirePermission', () => {
  it('should not throw for valid permissions', () => {
    expect(() => requirePermission(ownerMember, USERS_INVITE)).not.toThrow();
    expect(() => requirePermission(adminMember, BRANDS_CREATE)).not.toThrow();
    expect(() => requirePermission(memberWithAccess, EVENTS_CREATE)).not.toThrow();
  });

  it('should throw for invalid permissions', () => {
    expect(() => requirePermission(adminMember, ORG_DELETE)).toThrow(
      /Permission denied.*lacks required permission/
    );
    expect(() => requirePermission(memberWithAccess, USERS_INVITE)).toThrow(
      /Permission denied.*lacks required permission/
    );
  });
});

describe('Permission System - requireAnyPermission', () => {
  it('should not throw if member has at least one permission', () => {
    expect(() =>
      requireAnyPermission(adminMember, [USERS_INVITE, ORG_DELETE])
    ).not.toThrow();
  });

  it('should throw if member has none of the permissions', () => {
    expect(() =>
      requireAnyPermission(memberWithAccess, [USERS_INVITE, BRANDS_CREATE])
    ).toThrow(/Permission denied.*lacks required permissions/);
  });
});

describe('Permission System - requireAllPermissions', () => {
  it('should not throw if member has all permissions', () => {
    expect(() =>
      requireAllPermissions(ownerMember, [USERS_INVITE, BRANDS_CREATE])
    ).not.toThrow();
  });

  it('should throw if member lacks any permission', () => {
    expect(() =>
      requireAllPermissions(adminMember, [USERS_INVITE, ORG_DELETE])
    ).toThrow(/Permission denied.*lacks required permissions/);
  });
});

describe('Permission System - Brand Access', () => {
  it('should grant brand access to owners for all brands', () => {
    expect(hasBrandAccess(ownerMember, 'any_brand')).toBe(true);
    expect(hasBrandAccess(ownerMember, 'another_brand')).toBe(true);
  });

  it('should grant brand access to admins for all brands', () => {
    expect(hasBrandAccess(adminMember, 'any_brand')).toBe(true);
    expect(hasBrandAccess(adminMember, 'another_brand')).toBe(true);
  });

  it('should grant brand access to members only for brands in their list', () => {
    expect(hasBrandAccess(memberWithAccess, 'brand_abc')).toBe(true);
    expect(hasBrandAccess(memberWithAccess, 'brand_xyz')).toBe(true);
    expect(hasBrandAccess(memberWithAccess, 'brand_other')).toBe(false);
  });

  it('should deny brand access to members with empty brandAccess array', () => {
    expect(hasBrandAccess(memberNoAccess, 'any_brand')).toBe(false);
  });

  it('should throw when requiring access member does not have', () => {
    expect(() => requireBrandAccess(ownerMember, 'any_brand')).not.toThrow();
    expect(() => requireBrandAccess(memberWithAccess, 'brand_abc')).not.toThrow();
    expect(() => requireBrandAccess(memberWithAccess, 'other_brand')).toThrow(
      /Access denied.*does not have access to brand/
    );
  });
});

describe('Permission System - canModifyMemberRole', () => {
  it('should allow owners to modify admins and members', () => {
    expect(canModifyMemberRole(ownerMember, adminMember)).toBe(true);
    expect(canModifyMemberRole(ownerMember, memberWithAccess)).toBe(true);
  });

  it('should not allow owners to modify other owners', () => {
    const anotherOwner: OrganizationMember = { ...ownerMember, userId: 'user999' };
    expect(canModifyMemberRole(ownerMember, anotherOwner)).toBe(false);
  });

  it('should allow admins to modify members only', () => {
    expect(canModifyMemberRole(adminMember, memberWithAccess)).toBe(true);
    expect(canModifyMemberRole(adminMember, ownerMember)).toBe(false);
    
    const anotherAdmin: OrganizationMember = { ...adminMember, userId: 'user888' };
    expect(canModifyMemberRole(adminMember, anotherAdmin)).toBe(false);
  });

  it('should not allow members to modify anyone', () => {
    expect(canModifyMemberRole(memberWithAccess, ownerMember)).toBe(false);
    expect(canModifyMemberRole(memberWithAccess, adminMember)).toBe(false);
    expect(canModifyMemberRole(memberWithAccess, memberNoAccess)).toBe(false);
  });

  it('should throw when requiring modification rights user does not have', () => {
    expect(() =>
      requireCanModifyMemberRole(ownerMember, adminMember)
    ).not.toThrow();
    expect(() =>
      requireCanModifyMemberRole(adminMember, ownerMember)
    ).toThrow(/Permission denied.*cannot modify.*role/);
    expect(() =>
      requireCanModifyMemberRole(memberWithAccess, adminMember)
    ).toThrow(/Permission denied.*cannot modify.*role/);
  });
});

describe('Permission System - canInviteRole', () => {
  it('should allow owners to invite any role', () => {
    expect(canInviteRole(ownerMember, 'owner')).toBe(true);
    expect(canInviteRole(ownerMember, 'admin')).toBe(true);
    expect(canInviteRole(ownerMember, 'member')).toBe(true);
  });

  it('should allow admins to invite admin and member, but not owner', () => {
    expect(canInviteRole(adminMember, 'owner')).toBe(false);
    expect(canInviteRole(adminMember, 'admin')).toBe(true);
    expect(canInviteRole(adminMember, 'member')).toBe(true);
  });

  it('should not allow members to invite anyone', () => {
    expect(canInviteRole(memberWithAccess, 'owner')).toBe(false);
    expect(canInviteRole(memberWithAccess, 'admin')).toBe(false);
    expect(canInviteRole(memberWithAccess, 'member')).toBe(false);
  });

  it('should throw when requiring invite rights user does not have', () => {
    expect(() =>
      requireCanInviteRole(ownerMember, 'owner')
    ).not.toThrow();
    expect(() =>
      requireCanInviteRole(adminMember, 'owner')
    ).toThrow(/Permission denied.*cannot invite.*owner/);
    expect(() =>
      requireCanInviteRole(memberWithAccess, 'admin')
    ).toThrow(/Permission denied.*cannot invite.*admin/);
  });
});

describe('Permission System - canChangeSelfRole', () => {
  it('should allow owner to change own role if multiple owners exist', () => {
    expect(canChangeSelfRole(ownerMember, 2)).toBe(true);
    expect(canChangeSelfRole(ownerMember, 3)).toBe(true);
    expect(canChangeSelfRole(ownerMember, 10)).toBe(true);
  });

  it('should not allow owner to change own role if they are the last owner', () => {
    expect(canChangeSelfRole(ownerMember, 1)).toBe(false);
  });

  it('should not allow non-owners to use this check', () => {
    expect(canChangeSelfRole(adminMember, 2)).toBe(false);
    expect(canChangeSelfRole(memberWithAccess, 2)).toBe(false);
  });

  it('should throw when last owner tries to change their role', () => {
    expect(() =>
      requireCanChangeSelfRole(ownerMember, 2)
    ).not.toThrow();
    expect(() =>
      requireCanChangeSelfRole(ownerMember, 1)
    ).toThrow(/Cannot change role.*only owner/);
  });

  it('should throw when non-owner tries to use this check', () => {
    expect(() =>
      requireCanChangeSelfRole(adminMember, 2)
    ).toThrow(/Cannot change role.*only owner/);
  });
});

describe('Permission System - Utility Functions', () => {
  it('should return effective permissions based on role', () => {
    const ownerPerms = getEffectivePermissions(ownerMember);
    const adminPerms = getEffectivePermissions(adminMember);
    const memberPerms = getEffectivePermissions(memberWithAccess);

    expect(ownerPerms).toContain('*');
    expect(adminPerms).toContain(USERS_INVITE);
    expect(memberPerms).toContain(EVENTS_CREATE);
  });

  it('should return correct role display names', () => {
    expect(getRoleDisplayName('owner')).toBe('Owner');
    expect(getRoleDisplayName('admin')).toBe('Admin');
    expect(getRoleDisplayName('member')).toBe('Member');
  });

  it('should return correct role descriptions', () => {
    expect(getRoleDescription('owner')).toContain('Full control');
    expect(getRoleDescription('admin')).toContain('Manage team');
    expect(getRoleDescription('member')).toContain('assigned brands');
  });
});
