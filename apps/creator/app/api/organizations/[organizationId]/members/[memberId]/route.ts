/**
 * DELETE /api/organizations/[organizationId]/members/[memberId]
 *
 * Server-side endpoint for removing a member from an organisation.
 * Requires users:remove permission and respects role hierarchy rules.
 *
 * Authorization: Bearer <Firebase ID Token>
 *
 * Response:
 * 200: { success: true }
 * 401: { error: string }
 * 403: { error: string }
 * 404: { error: string }
 * 500: { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { authenticateRequest } from "@/lib/api-auth";
import {
  hasPermission,
  canModifyMemberRole,
  USERS_REMOVE,
} from "@brayford/core";
import type { OrganizationMember } from "@brayford/core";

export async function DELETE(
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

    // 3. Prevent self-removal
    if (targetData.userId === uid) {
      return NextResponse.json(
        {
          error:
            "You cannot remove yourself. Transfer ownership first or delete the organisation.",
        },
        { status: 400 },
      );
    }

    // 4. Fetch the acting member
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

    if (!hasPermission(actorMember, USERS_REMOVE)) {
      return NextResponse.json(
        { error: "You do not have permission to remove members" },
        { status: 403 },
      );
    }

    // Check role hierarchy (cannot remove someone of equal or higher role, unless owner)
    const targetMember = {
      organizationId: targetData.organizationId,
      userId: targetData.userId,
      role: targetData.role,
      brandAccess: targetData.brandAccess || [],
    } as OrganizationMember;

    if (!canModifyMemberRole(actorMember, targetMember)) {
      return NextResponse.json(
        { error: "You cannot remove this member" },
        { status: 403 },
      );
    }

    // 5. Delete the member document
    await targetRef.delete();

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Member removal failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
