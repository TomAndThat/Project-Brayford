/**
 * Permission System - Helper Functions
 * 
 * Runtime permission checking and validation.
 */

import type { Permission } from './types';
import { isWildcardPermission } from './types';
import type {
  OrganizationMember,
  OrganizationMemberDocument,
  OrganizationRole,
} from '../schemas/organization.schema';
import { getPermissionsForRole } from './role-mappings';
import { BRANDS_VIEW, BRANDS_CREATE, USERS_UPDATE_ROLE, USERS_INVITE } from './constants';
import type { BrandId } from '../types/branded';

/**
 * Get effective permissions for an organization member
 * 
 * If member has custom permissions array, use that.
 * Otherwise, derive from role.
 */
export function getEffectivePermissions(
  member: OrganizationMember | OrganizationMemberDocument
): Permission[] {
  // Future: Check for custom permissions field
  // For now, always derive from role
  return getPermissionsForRole(member.role);
}

/**
 * Check if a member has a specific permission
 * 
 * @param member - Organization member to check
 * @param permission - Permission to check for
 * @returns true if member has the permission
 */
export function hasPermission(
  member: OrganizationMember | OrganizationMemberDocument,
  permission: Permission
): boolean {
  const permissions = getEffectivePermissions(member);
  
  // Check for wildcard permission (owner)
  if (permissions.some(isWildcardPermission)) {
    return true;
  }
  
  // Check for specific permission
  return permissions.includes(permission);
}

/**
 * Check if a member has any of the specified permissions
 * 
 * @param member - Organization member to check
 * @param permissions - Array of permissions to check for
 * @returns true if member has at least one permission
 */
export function hasAnyPermission(
  member: OrganizationMember | OrganizationMemberDocument,
  permissions: Permission[]
): boolean {
  return permissions.some((permission) => hasPermission(member, permission));
}

/**
 * Check if a member has all of the specified permissions
 * 
 * @param member - Organization member to check
 * @param permissions - Array of permissions to check for
 * @returns true if member has all permissions
 */
export function hasAllPermissions(
  member: OrganizationMember | OrganizationMemberDocument,
  permissions: Permission[]
): boolean {
  return permissions.every((permission) => hasPermission(member, permission));
}

/**
 * Require a specific permission or throw error
 * 
 * @param member - Organization member to check
 * @param permission - Permission to require
 * @throws Error if member lacks permission
 */
export function requirePermission(
  member: OrganizationMember | OrganizationMemberDocument,
  permission: Permission
): void {
  if (!hasPermission(member, permission)) {
    throw new Error(
      `Permission denied: ${member.role} role lacks required permission "${permission}"`
    );
  }
}

/**
 * Require any of the specified permissions or throw error
 * 
 * @param member - Organization member to check
 * @param permissions - Array of permissions to check for
 * @throws Error if member lacks all permissions
 */
export function requireAnyPermission(
  member: OrganizationMember | OrganizationMemberDocument,
  permissions: Permission[]
): void {
  if (!hasAnyPermission(member, permissions)) {
    throw new Error(
      `Permission denied: ${member.role} role lacks required permissions (needs one of: ${permissions.join(', ')})`
    );
  }
}

/**
 * Require all of the specified permissions or throw error
 * 
 * @param member - Organization member to check
 * @param permissions - Array of permissions to check for
 * @throws Error if member lacks any permission
 */
export function requireAllPermissions(
  member: OrganizationMember | OrganizationMemberDocument,
  permissions: Permission[]
): void {
  const missingPermissions = permissions.filter(
    (permission) => !hasPermission(member, permission)
  );
  
  if (missingPermissions.length > 0) {
    throw new Error(
      `Permission denied: ${member.role} role lacks required permissions: ${missingPermissions.join(', ')}`
    );
  }
}

/**
 * Check if a member has access to a specific brand
 * 
 * Uses the permission system (not role checks) to determine access.
 * Members with brand management capability (BRANDS_CREATE) and an empty
 * brandAccess array have implicit access to all brands (owners/admins).
 * Members with a populated brandAccess array must have the specific brand listed.
 * Members without brand management capability and an empty array have no access.
 * 
 * @param member - Organization member to check
 * @param brandId - Brand ID to check access for
 * @returns true if member can access the brand
 */
export function hasBrandAccess(
  member: OrganizationMember | OrganizationMemberDocument,
  brandId: string | BrandId
): boolean {
  // Must have brand viewing permission
  if (!hasPermission(member, BRANDS_VIEW)) {
    return false;
  }
  
  // Members with specific brand assignments → check the list
  if (member.brandAccess.length > 0) {
    return member.brandAccess.includes(brandId as BrandId);
  }
  
  // Empty brandAccess: only members with brand management capability
  // (BRANDS_CREATE — owners/admins) have implicit all-brand access.
  // Members without it have no access when brandAccess is empty.
  return hasPermission(member, BRANDS_CREATE);
}

/**
 * Require brand access or throw error
 * 
 * @param member - Organization member to check
 * @param brandId - Brand ID to check access for
 * @throws Error if member lacks access
 */
export function requireBrandAccess(
  member: OrganizationMember | OrganizationMemberDocument,
  brandId: string | BrandId
): void {
  if (!hasBrandAccess(member, brandId)) {
    throw new Error(
      `Access denied: ${member.role} does not have access to brand ${brandId}`
    );
  }
}

/**
 * Check if a member can modify another member's role
 * 
 * Uses the permission system to validate capability, then applies
 * structural constraints:
 * - Must have users:update_role permission
 * - Cannot modify owners (protected role)
 * - Cannot modify yourself (use canChangeSelfRole for self-demotion)
 * 
 * @param actor - Member attempting the action
 * @param target - Member being modified
 * @returns true if actor can modify target
 */
export function canModifyMemberRole(
  actor: OrganizationMember | OrganizationMemberDocument,
  target: OrganizationMember | OrganizationMemberDocument
): boolean {
  // Must have the permission to update roles
  if (!hasPermission(actor, USERS_UPDATE_ROLE)) {
    return false;
  }
  
  // Cannot modify owners (only owners can self-demote via canChangeSelfRole)
  if (target.role === 'owner') {
    return false;
  }
  
  // Cannot modify yourself
  if (actor.userId === target.userId) {
    return false;
  }
  
  // Non-wildcard holders (admins) cannot modify peers who also have update_role
  const actorPermissions = getEffectivePermissions(actor);
  if (!actorPermissions.some(isWildcardPermission) && hasPermission(target, USERS_UPDATE_ROLE)) {
    return false;
  }
  
  return true;
}

/**
 * Require ability to modify member role or throw error
 * 
 * @param actor - Member attempting the action
 * @param target - Member being modified
 * @throws Error if actor cannot modify target
 */
export function requireCanModifyMemberRole(
  actor: OrganizationMember | OrganizationMemberDocument,
  target: OrganizationMember | OrganizationMemberDocument
): void {
  if (!canModifyMemberRole(actor, target)) {
    throw new Error(
      `Permission denied: ${actor.role} cannot modify ${target.role} role`
    );
  }
}

/**
 * Check if a member can invite someone with a specific role
 * 
 * Uses the permission system to validate capability:
 * - Must have users:invite permission
 * - Only members with wildcard permission (owners) can invite to owner role
 * 
 * @param actor - Member attempting to invite
 * @param targetRole - Role to be assigned to invitee
 * @returns true if actor can invite at this role level
 */
export function canInviteRole(
  actor: OrganizationMember | OrganizationMemberDocument,
  targetRole: OrganizationRole
): boolean {
  // Must have the permission to invite
  if (!hasPermission(actor, USERS_INVITE)) {
    return false;
  }
  
  // Only members with wildcard permission can invite to owner role
  if (targetRole === 'owner') {
    const permissions = getEffectivePermissions(actor);
    return permissions.some(isWildcardPermission);
  }
  
  return true;
}

/**
 * Require ability to invite at role level or throw error
 * 
 * @param actor - Member attempting to invite
 * @param targetRole - Role to be assigned to invitee
 * @throws Error if actor cannot invite at this role level
 */
export function requireCanInviteRole(
  actor: OrganizationMember | OrganizationMemberDocument,
  targetRole: OrganizationRole
): void {
  if (!canInviteRole(actor, targetRole)) {
    throw new Error(
      `Permission denied: ${actor.role} cannot invite ${targetRole} role`
    );
  }
}

/**
 * Check if a member can change their own role (self-demotion)
 * 
 * Uses the permission system to validate capability:
 * - Only members with wildcard permission (owners) can self-demote
 * - Must have at least one other owner remaining to prevent org lockout
 * 
 * @param actor - Member attempting the role change
 * @param currentOwnerCount - Total number of owners in the organization
 * @returns true if actor can change their own role
 */
export function canChangeSelfRole(
  actor: OrganizationMember | OrganizationMemberDocument,
  currentOwnerCount: number
): boolean {
  // Only members with wildcard permission (owners) can self-demote
  const permissions = getEffectivePermissions(actor);
  if (!permissions.some(isWildcardPermission)) {
    return false;
  }
  
  // Must have at least one other owner remaining
  return currentOwnerCount >= 2;
}

/**
 * Require ability to change own role or throw error
 * 
 * @param actor - Member attempting the role change
 * @param currentOwnerCount - Total number of owners in the organization
 * @throws Error if actor cannot change their own role
 */
export function requireCanChangeSelfRole(
  actor: OrganizationMember | OrganizationMemberDocument,
  currentOwnerCount: number
): void {
  if (!canChangeSelfRole(actor, currentOwnerCount)) {
    throw new Error(
      `Permission denied: Cannot change role. You are the only owner of this organisation. Invite or promote another owner first.`
    );
  }
}

/**
 * Get a user-friendly role display name
 */
export function getRoleDisplayName(role: OrganizationRole): string {
  const displayNames: Record<OrganizationRole, string> = {
    owner: 'Owner',
    admin: 'Admin',
    member: 'Member',
  };
  return displayNames[role];
}

/**
 * Get a user-friendly role description
 */
export function getRoleDescription(role: OrganizationRole): string {
  const descriptions: Record<OrganizationRole, string> = {
    owner: 'Full control over organization, billing, and all resources',
    admin: 'Manage team members and all brands/events',
    member: 'Access to assigned brands only',
  };
  return descriptions[role];
}
