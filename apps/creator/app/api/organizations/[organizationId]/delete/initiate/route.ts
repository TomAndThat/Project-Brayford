/**
 * POST /api/organizations/[organizationId]/delete/initiate
 * 
 * Initiates the organization deletion process.
 * 
 * Flow:
 * 1. Verify authentication and org:delete permission
 * 2. Check no pending deletion request exists
 * 3. Create deletion request with confirmation token
 * 4. Send confirmation email to requester
 * 5. Return success
 * 
 * Request body:
 * {
 *   confirmationName: string  // Must match org name (case-insensitive)
 * }
 * 
 * Authorization: Bearer <Firebase ID Token>
 * 
 * Response:
 * 200: { message: string, requestId: string }
 * 400: { error: string }
 * 401: { error: string }
 * 403: { error: string }
 * 409: { error: string }
 * 500: { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { sendDeletionConfirmEmail } from "@brayford/email-utils";
import type { OrganizationId, UserId } from "@brayford/core";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> },
): Promise<NextResponse> {
  try {
    const { organizationId } = await params;

    // 1. Verify authentication
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 },
      );
    }

    const idToken = authHeader.slice(7);
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json(
        { error: "Invalid or expired authentication token" },
        { status: 401 },
      );
    }

    const userId = decodedToken.uid;
    const userEmail = decodedToken.email;

    if (!userEmail) {
      return NextResponse.json(
        { error: "User account has no email address" },
        { status: 400 },
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const { confirmationName } = body as { confirmationName: string };

    if (!confirmationName || typeof confirmationName !== "string") {
      return NextResponse.json(
        { error: "confirmationName is required" },
        { status: 400 },
      );
    }

    // 3. Verify organization exists
    const orgRef = adminDb.collection("organizations").doc(organizationId);
    const orgSnap = await orgRef.get();

    if (!orgSnap.exists) {
      return NextResponse.json(
        { error: "Organisation not found" },
        { status: 404 },
      );
    }

    const orgData = orgSnap.data()!;

    // 4. Verify name matches (case-insensitive)
    if (
      confirmationName.trim().toLowerCase() !==
      orgData.name.trim().toLowerCase()
    ) {
      return NextResponse.json(
        { error: "Organisation name does not match" },
        { status: 400 },
      );
    }

    // 5. Verify permission - check org:delete via member record
    const memberQuery = await adminDb
      .collection("organizationMembers")
      .where("organizationId", "==", organizationId)
      .where("userId", "==", userId)
      .limit(1)
      .get();

    if (memberQuery.empty) {
      return NextResponse.json(
        { error: "You are not a member of this organisation" },
        { status: 403 },
      );
    }

    const memberData = memberQuery.docs[0]!.data();

    // Check permissions - either wildcard (*) or explicit org:delete
    const permissions: string[] = memberData.permissions || [];
    const hasWildcard = permissions.includes("*");
    const hasDeletePerm = permissions.includes("org:delete");

    // If no custom permissions, derive from role
    if (permissions.length === 0) {
      // Owner has wildcard (*), which includes org:delete
      if (memberData.role !== "owner") {
        return NextResponse.json(
          { error: "You do not have permission to delete this organisation" },
          { status: 403 },
        );
      }
      // Owner role is fine - has implicit org:delete via wildcard
    } else if (!hasWildcard && !hasDeletePerm) {
      return NextResponse.json(
        { error: "You do not have permission to delete this organisation" },
        { status: 403 },
      );
    }

    // 6. Check for existing pending deletion request
    if (orgData.deletionRequestId) {
      // Check if the existing request is still valid
      const existingReqRef = adminDb
        .collection("organizationDeletionRequests")
        .doc(orgData.deletionRequestId);
      const existingReqSnap = await existingReqRef.get();

      if (existingReqSnap.exists) {
        const existingReq = existingReqSnap.data()!;
        const status = existingReq.status;

        if (status === "pending-email" || status === "confirmed-deletion") {
          return NextResponse.json(
            {
              error:
                "A deletion request is already pending for this organisation",
            },
            { status: 409 },
          );
        }
      }
    }

    // 7. Generate tokens and dates
    const confirmationToken = crypto.randomUUID();
    const now = new Date();
    const tokenExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    // 8. Create deletion request document
    const deletionRequestRef = adminDb
      .collection("organizationDeletionRequests")
      .doc();

    const deletionRequest = {
      organizationId,
      organizationName: orgData.name,
      requestedBy: userId,
      requestedAt: Timestamp.fromDate(now),
      confirmationToken,
      tokenExpiresAt: Timestamp.fromDate(tokenExpiresAt),
      confirmationEmailSentAt: Timestamp.fromDate(now),
      confirmedAt: null,
      confirmedVia: null,
      status: "pending-email",
      scheduledDeletionAt: null,
      undoToken: null,
      undoExpiresAt: null,
      auditLog: [
        {
          timestamp: Timestamp.fromDate(now),
          action: "Deletion requested",
          userId,
          metadata: {
            userEmail,
            organizationName: orgData.name,
          },
        },
      ],
    };

    // 9. Batch write: create request + update org reference
    const batch = adminDb.batch();
    batch.set(deletionRequestRef, deletionRequest);
    batch.update(orgRef, { deletionRequestId: deletionRequestRef.id });
    await batch.commit();

    // 10. Send confirmation email
    const confirmationLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/delete-organization/confirm?token=${confirmationToken}&requestId=${deletionRequestRef.id}`;

    // Look up requester's display name for the email
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const displayName = userDoc.exists
      ? userDoc.data()!.displayName
      : userEmail;

    try {
      await sendDeletionConfirmEmail({
        recipientEmail: userEmail,
        organizationName: orgData.name,
        requestedBy: displayName,
        confirmationUrl: confirmationLink,
        expiresAt: tokenExpiresAt,
        organizationId: organizationId as OrganizationId,
        requestedByUserId: userId as UserId,
      });
    } catch (emailError) {
      console.error("[Deletion] Failed to send confirmation email:", emailError);
      // Don't fail the request — the link is in the deletion request doc
      // and can be resent
    }

    return NextResponse.json(
      {
        message: "Deletion request created. Check your email to confirm.",
        requestId: deletionRequestRef.id,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Deletion initiation failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
