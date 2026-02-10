/**
 * POST /api/invitations/[invitationId]/cancel
 *
 * Server-side endpoint for cancelling a pending invitation.
 * Sets the invitation status to 'cancelled' for audit trail
 * (the original client-side version deleted the document).
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
import { hasPermission, USERS_INVITE } from "@brayford/core";
import type { OrganizationMember } from "@brayford/core";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ invitationId: string }> },
): Promise<NextResponse> {
  try {
    // 1. Authenticate
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    const { uid } = auth;

    const { invitationId } = await params;

    // 2. Fetch the invitation
    const invRef = adminDb.collection("invitations").doc(invitationId);
    const invDoc = await invRef.get();

    if (!invDoc.exists) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 },
      );
    }

    const invData = invDoc.data()!;

    if (invData.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending invitations can be cancelled" },
        { status: 400 },
      );
    }

    // 3. Verify caller has invite permission in the invitation's organisation
    const memberQuery = await adminDb
      .collection("organizationMembers")
      .where("organizationId", "==", invData.organizationId)
      .where("userId", "==", uid)
      .limit(1)
      .get();

    if (memberQuery.empty) {
      return NextResponse.json(
        { error: "You are not a member of this organisation" },
        { status: 403 },
      );
    }

    const memberData = memberQuery.docs[0]!.data();
    const actorMember = {
      organizationId: memberData.organizationId,
      userId: memberData.userId,
      role: memberData.role,
      permissions: memberData.permissions || [],
      brandAccess: memberData.brandAccess || [],
    } as OrganizationMember;

    if (!hasPermission(actorMember, USERS_INVITE)) {
      return NextResponse.json(
        { error: "You do not have permission to manage invitations" },
        { status: 403 },
      );
    }

    // 4. Cancel the invitation (set status instead of deleting for audit trail)
    await invRef.update({
      status: "cancelled",
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Invitation cancellation failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
