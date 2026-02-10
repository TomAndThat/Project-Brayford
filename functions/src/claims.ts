/**
 * Custom Claims Utility
 *
 * Manages Firebase Auth custom claims for permission-based read authorisation.
 * Claims encode a user's organisation memberships and permissions into the
 * auth token so Firestore rules can check access without extra DB lookups.
 *
 * ## Claims Structure
 *
 * ```json
 * {
 *   "orgs": {
 *     "orgId1": { "p": ["*"], "b": [] },
 *     "orgId2": { "p": ["ou", "ui", "bv", ...], "b": ["brand1", "brand2"] }
 *   },
 *   "cv": 3
 * }
 * ```
 *
 * - `orgs` — Map of org ID → { permissions, brand access }
 * - `p` — Abbreviated permission strings (see PERMISSION_ABBREVIATIONS)
 * - `b` — Brand IDs the user can access (empty = all brands)
 * - `cv` — Claims version counter for forced client-side token refresh
 *
 * ## Size Budget
 *
 * Firebase custom claims have a 1000-byte limit. With abbreviated permissions:
 * - Owner in 1 org: ~50 bytes
 * - Admin in 1 org: ~200 bytes
 * - Member in 1 org with 3 brands: ~250 bytes
 * - Single-org users (vast majority): well within limit
 */

import {getAuth} from "firebase-admin/auth";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {getPermissionsForRole} from "@brayford/core";
import type {OrganizationRole} from "@brayford/core";
import * as logger from "firebase-functions/logger";

// ===== Permission Abbreviation Mapping =====

/**
 * Maps full permission strings to 2-3 character abbreviations.
 * Used to minimise claims size (1000-byte limit).
 *
 * Convention: first letter of category + first letter(s) of action
 * - org:update → ou
 * - users:invite → ui
 * - brands:view → bv
 * - events:manage_modules → emm
 */
const PERMISSION_ABBREVIATIONS: Record<string, string> = {
  // Wildcard
  "*": "*",
  // Organization
  "org:update": "ou",
  "org:delete": "od",
  "org:transfer": "ot",
  "org:view_billing": "ovb",
  "org:manage_billing": "omb",
  "org:view_settings": "ovs",
  // Users
  "users:invite": "ui",
  "users:view": "uv",
  "users:update_role": "uur",
  "users:update_access": "uua",
  "users:remove": "ur",
  // Brands
  "brands:create": "bc",
  "brands:view": "bv",
  "brands:update": "bu",
  "brands:delete": "bd",
  "brands:manage_team": "bmt",
  // Events
  "events:create": "ec",
  "events:view": "ev",
  "events:update": "eu",
  "events:publish": "ep",
  "events:delete": "ed",
  "events:manage_modules": "emm",
  "events:moderate": "emo",
  // Analytics
  "analytics:view_org": "avo",
  "analytics:view_brand": "avb",
  "analytics:view_event": "ave",
  "analytics:export": "ae",
};

/**
 * Abbreviate a permission string for claims storage.
 * Falls back to the full string if no abbreviation exists.
 */
function abbreviatePermission(permission: string): string {
  return PERMISSION_ABBREVIATIONS[permission] ?? permission;
}

// ===== Claims Types =====

interface OrgClaim {
  /** Abbreviated permission strings */
  p: string[];
  /** Brand IDs (empty = all brands) */
  b: string[];
}

interface UserClaims {
  /** Organisation membership claims */
  orgs: Record<string, OrgClaim>;
  /** Claims version — bumped on each update to trigger client refresh */
  cv: number;
}

// ===== Claims Building =====

interface MembershipData {
  organizationId: string;
  role: OrganizationRole;
  brandAccess: string[];
}

/**
 * Build the custom claims object from a user's organisation memberships.
 *
 * @param memberships - All active memberships for the user
 * @param currentClaimsVersion - Current cv value (will be incremented)
 * @returns Claims object ready for setCustomUserClaims
 */
export function buildUserClaims(
  memberships: MembershipData[],
  currentClaimsVersion: number,
): UserClaims {
  const orgs: Record<string, OrgClaim> = {};

  for (const membership of memberships) {
    const permissions = getPermissionsForRole(membership.role);
    const abbreviated = permissions.map(
      (p) => abbreviatePermission(p.toString()),
    );

    orgs[membership.organizationId] = {
      p: abbreviated,
      b: membership.brandAccess ?? [],
    };
  }

  return {
    orgs,
    cv: currentClaimsVersion + 1,
  };
}

/**
 * Fetch all active memberships for a user from Firestore.
 *
 * @param userId - Firebase Auth UID
 * @returns Array of membership data
 */
export async function getUserMemberships(
  userId: string,
): Promise<MembershipData[]> {
  const db = getFirestore();
  const membersQuery = await db
    .collection("organizationMembers")
    .where("userId", "==", userId)
    .get();

  return membersQuery.docs.map((doc) => {
    const data = doc.data();
    return {
      organizationId: data.organizationId as string,
      role: data.role as OrganizationRole,
      brandAccess: (data.brandAccess as string[]) ?? [],
    };
  });
}

/**
 * Update a user's custom claims and bump the claimsVersion on their user doc.
 *
 * This is the main entry point called by the Cloud Function trigger.
 *
 * Steps:
 * 1. Fetch all current memberships for the user
 * 2. Read current claims version from existing claims
 * 3. Build new claims with incremented version
 * 4. Set custom claims on the auth token
 * 5. Bump claimsVersion on the user's Firestore document
 *    (triggers client-side token refresh via onSnapshot listener)
 *
 * @param userId - Firebase Auth UID
 */
export async function updateUserClaims(userId: string): Promise<void> {
  const auth = getAuth();
  const db = getFirestore();

  // 1. Fetch all memberships
  const memberships = await getUserMemberships(userId);

  // 2. Read current claims version
  let currentCv = 0;
  try {
    const currentUser = await auth.getUser(userId);
    const existingClaims = currentUser.customClaims as UserClaims | undefined;
    currentCv = existingClaims?.cv ?? 0;
  } catch {
    // User may not exist yet in auth — default to 0
  }

  // 3. Build claims
  const claims = buildUserClaims(memberships, currentCv);

  // 4. Validate size (Firebase limit is 1000 bytes)
  const claimsSize = Buffer.byteLength(JSON.stringify(claims), "utf-8");
  if (claimsSize > 950) {
    // Leave 50 bytes of headroom
    logger.warn(
      `Claims for user ${userId} are ${claimsSize} bytes ` +
      "(approaching 1000-byte limit)",
      {userId, claimsSize, orgCount: memberships.length},
    );
  }

  if (claimsSize > 1000) {
    logger.error(
      `Claims for user ${userId} exceed 1000-byte limit (${claimsSize} bytes). ` +
      "Falling back to empty claims.",
      {userId, claimsSize},
    );
    // Set minimal claims so the user isn't completely locked out
    // Server-side API routes still work (they bypass rules)
    await auth.setCustomUserClaims(userId, {orgs: {}, cv: currentCv + 1});
    return;
  }

  // 5. Set claims
  await auth.setCustomUserClaims(userId, claims);

  logger.info(
    `Updated claims for user ${userId}: ${memberships.length} org(s), ` +
    `${claimsSize} bytes, cv=${claims.cv}`,
    {userId, orgCount: memberships.length, claimsSize, cv: claims.cv},
  );

  // 6. Bump claimsVersion on user doc to trigger client-side refresh
  const userRef = db.collection("users").doc(userId);
  await userRef.update({
    claimsVersion: FieldValue.increment(1),
  });
}
