import type { User } from "firebase/auth";

/**
 * Check if a user has super admin privileges
 * 
 * Super admins are Project Brayford internal staff who can access
 * any organization for support and administrative purposes without
 * being formal members of those organizations.
 * 
 * @param user - Firebase Auth user object
 * @returns Promise resolving to true if user has superAdmin custom claim
 * 
 * @example
 * ```ts
 * const user = auth.currentUser;
 * const hasAccess = await isSuperAdmin(user);
 * if (hasAccess) {
 *   // Show support mode banner
 * }
 * ```
 */
export async function isSuperAdmin(user: User | null): Promise<boolean> {
  if (!user) return false;

  try {
    const tokenResult = await user.getIdTokenResult();
    return tokenResult.claims.superAdmin === true;
  } catch (error) {
    console.error("Error checking super admin status:", error);
    return false;
  }
}

/**
 * Check super admin status from an already-fetched token result
 * 
 * Use this when you already have a token result to avoid an extra async call.
 * 
 * @param tokenResult - Firebase ID token result with claims
 * @returns True if user has superAdmin custom claim
 * 
 * @example
 * ```ts
 * const tokenResult = await user.getIdTokenResult();
 * const hasAccess = isSuperAdminFromToken(tokenResult);
 * ```
 */
export function isSuperAdminFromToken(tokenResult: {
  claims: Record<string, unknown>;
}): boolean {
  return tokenResult.claims.superAdmin === true;
}

/**
 * Force refresh of user's ID token to get latest custom claims
 * 
 * Call this after a user is granted/revoked super admin status to ensure
 * their token reflects the change immediately instead of waiting for
 * the token to expire (1 hour by default).
 * 
 * @param user - Firebase Auth user object
 * @returns Promise resolving to true if user is super admin after refresh
 * 
 * @example
 * ```ts
 * // After granting super admin via Cloud Function
 * await refreshSuperAdminStatus(user);
 * // Now user.getIdTokenResult() will have updated claims
 * ```
 */
export async function refreshSuperAdminStatus(
  user: User | null,
): Promise<boolean> {
  if (!user) return false;

  try {
    // Force token refresh
    const tokenResult = await user.getIdTokenResult(/* forceRefresh */ true);
    return tokenResult.claims.superAdmin === true;
  } catch (error) {
    console.error("Error refreshing super admin status:", error);
    return false;
  }
}
