/**
 * POST /api/invitations/[invitationId]/decline
 *
 * Server-side endpoint for declining an invitation.
 * The invited user (identified by their email) declines the invitation.
 *
 * Unlike other invitation routes, this validates that the caller's email
 * matches the invitation email, rather than checking organisation membership.
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ invitationId: string }> },
): Promise<NextResponse> {
  try {
    // 1. Authenticate
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    const { email } = auth;

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
        { error: "This invitation is no longer pending" },
        { status: 400 },
      );
    }

    // 3. Verify the caller is the invited user
    if (email.toLowerCase() !== invData.email?.toLowerCase()) {
      return NextResponse.json(
        { error: "You can only decline invitations sent to your email" },
        { status: 403 },
      );
    }

    // 4. Decline the invitation
    await invRef.update({
      status: "declined",
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Invitation decline failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
