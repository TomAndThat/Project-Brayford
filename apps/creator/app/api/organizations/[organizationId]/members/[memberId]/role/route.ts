/**
 * PATCH /api/organizations/[organizationId]/members/[memberId]/role
 *
 * Server-side endpoint for updating an organisation member's role or access.
 * Requires users:update_role permission and respects role escalation rules.
 *
 * Request body: { role?: string, brandAccess?: string[], autoGrantNewBrands?: boolean }
 * Authorization: Bearer <Firebase ID Token>
 *
 * Response:
 * 200: { success: true }
 * 400: { error: string }
 * 401: { error: string }
 * 403: { error: string }
 * 404: { error: string }
 * 500: { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { authenticateRequest } from "@/lib/api-auth";
import { updateUserClaims } from "@/lib/claims";
import {
  hasPermission,
  canModifyMemberRole,
  USERS_UPDATE_ROLE,
  USERS_UPDATE_ACCESS,
  validateUpdateOrganizationMemberData,
} from "@brayford/core";
import type { OrganizationMember } from "@brayford/core";

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ organizationId: string; memberId: string }> },
): Promise<NextResponse> {
  try {
    // 1. Authenticate
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    const { uid } = auth;

    const { organizationId, memberId } = await params;

    // 2. Fetch the target member
    const targetRef = adminDb.collection("organizationMembers").doc(memberId);
    const targetDoc = await targetRef.get();

    if (!targetDoc.exists) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 },
      );
    }

    const targetData = targetDoc.data()!;

    if (targetData.organizationId !== organizationId) {
      return NextResponse.json(
        { error: "Member does not belong to this organisation" },
        { status: 400 },
      );
    }

    // 3. Fetch the acting member
    const actorQuery = await adminDb
      .collection("organizationMembers")
      .where("organizationId", "==", organizationId)
      .where("userId", "==", uid)
      .limit(1)
      .get();

    if (actorQuery.empty) {
      return NextResponse.json(
        { error: "You are not a member of this organisation" },
        { status: 403 },
      );
    }

    const actorData = actorQuery.docs[0]!.data();
    const actorMember = {
      organizationId: actorData.organizationId,
      userId: actorData.userId,
      role: actorData.role,
      brandAccess: actorData.brandAccess || [],
    } as OrganizationMember;

    // 4. Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    let validatedData;
    try {
      validatedData = validateUpdateOrganizationMemberData(body);
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid update data", details: String(error) },
        { status: 400 },
      );
    }

    // 5. Permission checks
    if (validatedData.role !== undefined) {
      // Changing role requires users:update_role
      if (!hasPermission(actorMember, USERS_UPDATE_ROLE)) {
        return NextResponse.json(
          { error: "You do not have permission to change member roles" },
          { status: 403 },
        );
      }

      // Check role modification rules (peer protection, escalation prevention)
      const targetMember = {
        organizationId: targetData.organizationId,
        userId: targetData.userId,
        role: targetData.role,
        brandAccess: targetData.brandAccess || [],
      } as OrganizationMember;

      if (!canModifyMemberRole(actorMember, targetMember)) {
        return NextResponse.json(
          { error: "You cannot modify this member's role" },
          { status: 403 },
        );
      }

      // Prevent self-demotion (could lock out the org)
      if (targetData.userId === uid) {
        return NextResponse.json(
          { error: "You cannot change your own role" },
          { status: 400 },
        );
      }
    }

    if (
      validatedData.brandAccess !== undefined ||
      validatedData.autoGrantNewBrands !== undefined
    ) {
      // Changing access requires users:update_access
      if (!hasPermission(actorMember, USERS_UPDATE_ACCESS)) {
        return NextResponse.json(
          { error: "You do not have permission to change member access" },
          { status: 403 },
        );
      }
    }

    // 6. Update the member
    await targetRef.update(validatedData);

    // 7. Sync claims for the target user (reflects new role/access)
    await updateUserClaims(targetData.userId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Member update failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
