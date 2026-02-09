/**
 * Permission System
 * 
 * Capability-based permission system for organization access control.
 * 
 * @example
 * ```typescript
 * import { hasPermission, USERS_INVITE } from '@brayford/core/permissions';
 * 
 * if (hasPermission(member, USERS_INVITE)) {
 *   // Show invite button
 * }
 * ```
 */

// Types
export type { Permission, PermissionCategory, PermissionAction } from './types';
export {
  createPermission,
  isWildcardPermission,
  WILDCARD_PERMISSION,
} from './types';

// Permission constants
export {
  // Organization
  ORG_UPDATE,
  ORG_DELETE,
  ORG_TRANSFER,
  ORG_VIEW_BILLING,
  ORG_MANAGE_BILLING,
  ORGANIZATION_PERMISSIONS,
  // Users
  USERS_INVITE,
  USERS_VIEW,
  USERS_UPDATE_ROLE,
  USERS_UPDATE_ACCESS,
  USERS_REMOVE,
  USER_MANAGEMENT_PERMISSIONS,
  // Brands
  BRANDS_CREATE,
  BRANDS_VIEW,
  BRANDS_UPDATE,
  BRANDS_DELETE,
  BRANDS_MANAGE_TEAM,
  BRAND_MANAGEMENT_PERMISSIONS,
  // Events
  EVENTS_CREATE,
  EVENTS_VIEW,
  EVENTS_UPDATE,
  EVENTS_PUBLISH,
  EVENTS_DELETE,
  EVENTS_MANAGE_MODULES,
  EVENTS_MODERATE,
  EVENT_MANAGEMENT_PERMISSIONS,
  // Analytics
  ANALYTICS_VIEW_ORG,
  ANALYTICS_VIEW_BRAND,
  ANALYTICS_VIEW_EVENT,
  ANALYTICS_EXPORT,
  ANALYTICS_PERMISSIONS,
  // All
  ALL_PERMISSIONS,
} from './constants';

// Role mappings
export { ROLE_PERMISSIONS, getPermissionsForRole, roleHasPermission } from './role-mappings';

// Helper functions
export {
  getEffectivePermissions,
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
  getRoleDisplayName,
  getRoleDescription,
} from './helpers';
