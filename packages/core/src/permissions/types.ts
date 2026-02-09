/**
 * Permission System - Type Definitions
 * 
 * Defines the type system for capability-based permissions.
 */

/**
 * Branded type for permissions to prevent string typos
 */
export type Permission = string & { readonly __brand: 'Permission' };

/**
 * Wildcard permission - grants all capabilities
 */
export const WILDCARD_PERMISSION = '*' as Permission;

/**
 * Type-safe permission categories
 */
export type PermissionCategory =
  | 'org'
  | 'users'
  | 'brands'
  | 'events'
  | 'analytics';

/**
 * Permission action types
 */
export type PermissionAction =
  | 'view'
  | 'create'
  | 'update'
  | 'delete'
  | 'invite'
  | 'remove'
  | 'publish'
  | 'manage_billing'
  | 'view_billing'
  | 'view_settings'
  | 'transfer'
  | 'update_role'
  | 'update_access'
  | 'manage_team'
  | 'manage_modules'
  | 'moderate'
  | 'view_org'
  | 'view_brand'
  | 'view_event'
  | 'export';

/**
 * Helper to create type-safe permission strings
 */
export function createPermission(
  category: PermissionCategory,
  action: PermissionAction
): Permission {
  return `${category}:${action}` as Permission;
}

/**
 * Helper to check if a string is the wildcard permission
 */
export function isWildcardPermission(permission: string): boolean {
  return permission === WILDCARD_PERMISSION;
}
