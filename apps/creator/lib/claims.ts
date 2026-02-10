/**
 * Server-Side Custom Claims Utility
 *
 * Synchronously updates a user's Firebase Auth custom claims from their
 * current organisation memberships. Called by API routes after any mutation
 * to organizationMembers (create, update, delete).
 *
 * This mirrors the logic in functions/src/claims.ts but runs inside
 * Next.js API routes for synchronous, critical-path claims updates.
 * The Firestore trigger (onMembershipChange) remains as a safety net.
 *
 * ## Why both?
 *
 * - API route: guarantees claims exist before the response, so the client
 *   can immediately read Firestore collections gated by isOrgMember().
 * - Cloud Function trigger: catches membership changes made outside API
 *   routes (e.g., scheduled cleanup, Admin SDK scripts).
 */

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getPermissionsForRole, type OrganizationRole } from "@brayford/core";

// ===== Permission Abbreviation Mapping =====
// Must stay in sync with functions/src/claims.ts

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

function abbreviatePermission(permission: string): string {
  return PERMISSION_ABBREVIATIONS[permission] ?? permission;
}

// ===== Claims Types =====

interface OrgClaim {
  p: string[];
  b: string[];
}

interface UserClaims {
  orgs: Record<string, OrgClaim>;
  cv: number;
}

interface MembershipData {
  organizationId: string;
  role: OrganizationRole;
  brandAccess: string[];
}

// ===== Public API =====

/**
 * Update a user's custom claims and bump claimsVersion on their user doc.
 *
 * Call this from any API route that creates, updates, or deletes an
 * organizationMembers document. The affected user is the one whose
 * membership changed (not necessarily the requesting user).
 *
 * @param userId - Firebase Auth UID of the user whose claims need updating
 */
export async function updateUserClaims(userId: string): Promise<void> {
  // 1. Fetch all memberships
  const membershipsSnap = await adminDb
    .collection("organizationMembers")
    .where("userId", "==", userId)
    .get();

  const memberships: MembershipData[] = membershipsSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      organizationId: data.organizationId as string,
      role: data.role as OrganizationRole,
      brandAccess: (data.brandAccess as string[]) ?? [],
    };
  });

  // 2. Read current claims version
  let currentCv = 0;
  try {
    const currentUser = await adminAuth.getUser(userId);
    const existingClaims = currentUser.customClaims as UserClaims | undefined;
    currentCv = existingClaims?.cv ?? 0;
  } catch {
    // User may not exist yet in auth — default to 0
  }

  // 3. Build claims
  const orgs: Record<string, OrgClaim> = {};
  for (const membership of memberships) {
    const permissions = getPermissionsForRole(membership.role);
    const abbreviated = permissions.map((p) => abbreviatePermission(p.toString()));
    orgs[membership.organizationId] = {
      p: abbreviated,
      b: membership.brandAccess ?? [],
    };
  }

  const claims: UserClaims = {
    orgs,
    cv: currentCv + 1,
  };

  // 4. Validate size (Firebase limit is 1000 bytes)
  const claimsJson = JSON.stringify(claims);
  const claimsSize = Buffer.byteLength(claimsJson, "utf-8");

  if (claimsSize > 1000) {
    console.error(
      `[claims] User ${userId}: claims exceed 1000-byte limit (${claimsSize} bytes). ` +
        "Falling back to empty claims.",
    );
    await adminAuth.setCustomUserClaims(userId, { orgs: {}, cv: currentCv + 1 });
    return;
  }

  if (claimsSize > 950) {
    console.warn(
      `[claims] User ${userId}: claims are ${claimsSize} bytes (approaching 1000-byte limit)`,
    );
  }

  // 5. Set claims
  await adminAuth.setCustomUserClaims(userId, claims);

  console.log(
    `[claims] Updated claims for user ${userId}: ${memberships.length} org(s), ` +
      `${claimsSize} bytes, cv=${claims.cv}`,
  );

  // 6. Bump claimsVersion on user doc to trigger client-side refresh
  const userRef = adminDb.collection("users").doc(userId);
  await userRef.update({
    claimsVersion: FieldValue.increment(1),
  });
}
