/**
 * Permission System - Constants
 * 
 * Defines all available permissions in the system.
 * These are the atomic capabilities that can be granted to organization members.
 */

import type { Permission } from './types';
import { createPermission, WILDCARD_PERMISSION } from './types';

// ===== Organization Management =====

export const ORG_UPDATE = createPermission('org', 'update');
export const ORG_DELETE = createPermission('org', 'delete');
export const ORG_TRANSFER = createPermission('org', 'transfer');
export const ORG_VIEW_BILLING = createPermission('org', 'view_billing');
export const ORG_MANAGE_BILLING = createPermission('org', 'manage_billing');
export const ORG_VIEW_SETTINGS = createPermission('org', 'view_settings');

export const ORGANIZATION_PERMISSIONS: Permission[] = [
  ORG_UPDATE,
  ORG_DELETE,
  ORG_TRANSFER,
  ORG_VIEW_BILLING,
  ORG_MANAGE_BILLING,
  ORG_VIEW_SETTINGS,
];

// ===== User & Team Management =====

export const USERS_INVITE = createPermission('users', 'invite');
export const USERS_VIEW = createPermission('users', 'view');
export const USERS_UPDATE_ROLE = createPermission('users', 'update_role');
export const USERS_UPDATE_ACCESS = createPermission('users', 'update_access');
export const USERS_REMOVE = createPermission('users', 'remove');

export const USER_MANAGEMENT_PERMISSIONS: Permission[] = [
  USERS_INVITE,
  USERS_VIEW,
  USERS_UPDATE_ROLE,
  USERS_UPDATE_ACCESS,
  USERS_REMOVE,
];

// ===== Brand Management =====

export const BRANDS_CREATE = createPermission('brands', 'create');
export const BRANDS_VIEW = createPermission('brands', 'view');
export const BRANDS_UPDATE = createPermission('brands', 'update');
export const BRANDS_DELETE = createPermission('brands', 'delete');
export const BRANDS_MANAGE_TEAM = createPermission('brands', 'manage_team');

export const BRAND_MANAGEMENT_PERMISSIONS: Permission[] = [
  BRANDS_CREATE,
  BRANDS_VIEW,
  BRANDS_UPDATE,
  BRANDS_DELETE,
  BRANDS_MANAGE_TEAM,
];

// ===== Event Management =====

export const EVENTS_CREATE = createPermission('events', 'create');
export const EVENTS_VIEW = createPermission('events', 'view');
export const EVENTS_UPDATE = createPermission('events', 'update');
export const EVENTS_PUBLISH = createPermission('events', 'publish');
export const EVENTS_DELETE = createPermission('events', 'delete');
export const EVENTS_MANAGE_MODULES = createPermission('events', 'manage_modules');
export const EVENTS_MODERATE = createPermission('events', 'moderate');

export const EVENT_MANAGEMENT_PERMISSIONS: Permission[] = [
  EVENTS_CREATE,
  EVENTS_VIEW,
  EVENTS_UPDATE,
  EVENTS_PUBLISH,
  EVENTS_DELETE,
  EVENTS_MANAGE_MODULES,
  EVENTS_MODERATE,
];

// ===== Analytics & Reporting =====

export const ANALYTICS_VIEW_ORG = createPermission('analytics', 'view_org');
export const ANALYTICS_VIEW_BRAND = createPermission('analytics', 'view_brand');
export const ANALYTICS_VIEW_EVENT = createPermission('analytics', 'view_event');
export const ANALYTICS_EXPORT = createPermission('analytics', 'export');

export const ANALYTICS_PERMISSIONS: Permission[] = [
  ANALYTICS_VIEW_ORG,
  ANALYTICS_VIEW_BRAND,
  ANALYTICS_VIEW_EVENT,
  ANALYTICS_EXPORT,
];

// ===== All Permissions =====

/**
 * Complete list of all permissions in the system
 */
export const ALL_PERMISSIONS: Permission[] = [
  ...ORGANIZATION_PERMISSIONS,
  ...USER_MANAGEMENT_PERMISSIONS,
  ...BRAND_MANAGEMENT_PERMISSIONS,
  ...EVENT_MANAGEMENT_PERMISSIONS,
  ...ANALYTICS_PERMISSIONS,
];

/**
 * Wildcard permission - grants all capabilities
 * Used for owners who have unrestricted access
 */
export { WILDCARD_PERMISSION };
