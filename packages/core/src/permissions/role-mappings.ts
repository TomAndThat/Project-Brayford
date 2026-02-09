/**
 * Permission System - Role Mappings
 * 
 * Maps organization roles to their default permission sets.
 * These are the "presets" that make the UI simple while keeping the backend granular.
 */

import type { OrganizationRole } from '../schemas/organization.schema';
import type { Permission } from './types';
import { WILDCARD_PERMISSION } from './types';
import {
  // Organization
  ORG_UPDATE,
  ORG_DELETE,
  ORG_TRANSFER,
  ORG_VIEW_BILLING,
  ORG_MANAGE_BILLING,
  // Users
  USERS_INVITE,
  USERS_VIEW,
  USERS_UPDATE_ROLE,
  USERS_UPDATE_ACCESS,
  USERS_REMOVE,
  // Brands
  BRANDS_CREATE,
  BRANDS_VIEW,
  BRANDS_UPDATE,
  BRANDS_DELETE,
  BRANDS_MANAGE_TEAM,
  // Events
  EVENTS_CREATE,
  EVENTS_VIEW,
  EVENTS_UPDATE,
  EVENTS_PUBLISH,
  EVENTS_DELETE,
  EVENTS_MANAGE_MODULES,
  EVENTS_MODERATE,
  // Analytics
  ANALYTICS_VIEW_ORG,
  ANALYTICS_VIEW_BRAND,
  ANALYTICS_VIEW_EVENT,
  ANALYTICS_EXPORT,
} from './constants';

/**
 * Owner permissions - Full control over everything
 * Uses wildcard for maximum flexibility
 */
const OWNER_PERMISSIONS: Permission[] = [WILDCARD_PERMISSION];

/**
 * Admin permissions - Can manage team and all brands/events
 * Cannot access billing or delete organization
 */
const ADMIN_PERMISSIONS: Permission[] = [
  // Organization (limited)
  ORG_UPDATE,
  // User management
  USERS_INVITE,
  USERS_VIEW,
  USERS_UPDATE_ROLE,
  USERS_UPDATE_ACCESS,
  USERS_REMOVE,
  // Brand management
  BRANDS_CREATE,
  BRANDS_VIEW,
  BRANDS_UPDATE,
  BRANDS_DELETE,
  BRANDS_MANAGE_TEAM,
  // Event management
  EVENTS_CREATE,
  EVENTS_VIEW,
  EVENTS_UPDATE,
  EVENTS_PUBLISH,
  EVENTS_DELETE,
  EVENTS_MANAGE_MODULES,
  EVENTS_MODERATE,
  // Analytics
  ANALYTICS_VIEW_ORG,
  ANALYTICS_VIEW_BRAND,
  ANALYTICS_VIEW_EVENT,
  ANALYTICS_EXPORT,
];

/**
 * Member permissions - Limited to assigned brands only
 * Can create and manage events, but cannot invite users or manage brands
 */
const MEMBER_PERMISSIONS: Permission[] = [
  // User viewing
  USERS_VIEW,
  // Brand access (limited to brandAccess array)
  BRANDS_VIEW,
  BRANDS_UPDATE,
  // Event management (limited to accessible brands)
  EVENTS_CREATE,
  EVENTS_VIEW,
  EVENTS_UPDATE,
  EVENTS_PUBLISH,
  EVENTS_DELETE,
  EVENTS_MANAGE_MODULES,
  EVENTS_MODERATE,
  // Analytics (limited to accessible brands)
  ANALYTICS_VIEW_BRAND,
  ANALYTICS_VIEW_EVENT,
  ANALYTICS_EXPORT,
];

/**
 * Role-to-permission mapping
 * This is the single source of truth for what each role can do
 */
export const ROLE_PERMISSIONS: Record<OrganizationRole, Permission[]> = {
  owner: OWNER_PERMISSIONS,
  admin: ADMIN_PERMISSIONS,
  member: MEMBER_PERMISSIONS,
};

/**
 * Get the default permissions for a given role
 */
export function getPermissionsForRole(role: OrganizationRole): Permission[] {
  return [...ROLE_PERMISSIONS[role]]; // Return copy to prevent mutation
}

/**
 * Check if a role has a specific permission by default
 */
export function roleHasPermission(
  role: OrganizationRole,
  permission: Permission
): boolean {
  const rolePermissions = ROLE_PERMISSIONS[role];
  
  // Owner has wildcard, so they have everything
  if (rolePermissions.includes(WILDCARD_PERMISSION)) {
    return true;
  }
  
  return rolePermissions.includes(permission);
}
