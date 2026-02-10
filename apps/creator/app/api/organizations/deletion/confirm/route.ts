/**
 * POST /api/organizations/deletion/confirm
 * 
 * Confirms an organization deletion via the email confirmation link.
 * 
 * Flow:
 * 1. Validate confirmation token and request ID
 * 2. Check token hasn't expired (24h window)
 * 3. Mark org as soft-deleted
 * 4. Generate undo token
 * 5. Send alert emails to all members with org:delete permission
 * 6. Return confirmation page redirect
 * 
 * Query params:
 * - token: string (confirmation token from email)
 * - requestId: string (deletion request document ID)
 * 
 * Response:
 * 200: { message: string, scheduledDeletionAt: string }
 * 400: { error: string }
 * 404: { error: string }
 * 410: { error: string } (token expired)
 * 500: { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { sendDeletionAlertEmail } from "@brayford/email-utils";
import { getPermissionsForRole } from "@brayford/core";
import type { OrganizationId, OrganizationRole } from "@brayford/core";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Parse request body
    const body = await request.json();
    const { token, requestId } = body as {
      token: string;
      requestId: string;
    };

    if (!token || !requestId) {
      return NextResponse.json(
        { error: "Missing token or requestId" },
        { status: 400 },
      );
    }

    // 2. Fetch deletion request
    const requestRef = adminDb
      .collection("organizationDeletionRequests")
      .doc(requestId);
    const requestSnap = await requestRef.get();

    if (!requestSnap.exists) {
      return NextResponse.json(
        { error: "Deletion request not found" },
        { status: 404 },
      );
    }

    const deletionRequest = requestSnap.data()!;

    // 3. Validate token
    if (deletionRequest.confirmationToken !== token) {
      return NextResponse.json(
        { error: "Invalid confirmation token" },
        { status: 400 },
      );
    }

    // 4. Check status is still pending-email
    if (deletionRequest.status !== "pending-email") {
      return NextResponse.json(
        {
          error: `This deletion request has already been ${deletionRequest.status === "confirmed-deletion" ? "confirmed" : deletionRequest.status}`,
        },
        { status: 400 },
      );
    }

    // 5. Check token expiry
    const tokenExpiresAt =
      deletionRequest.tokenExpiresAt instanceof Timestamp
        ? deletionRequest.tokenExpiresAt.toDate()
        : new Date(deletionRequest.tokenExpiresAt);

    if (new Date() > tokenExpiresAt) {
      // Mark as expired and clear org reference
      const batch = adminDb.batch();
      batch.update(requestRef, {
        status: "cancelled",
        auditLog: [
          ...deletionRequest.auditLog,
          {
            timestamp: Timestamp.fromDate(new Date()),
            action: "Confirmation token expired",
            userId: null,
          },
        ],
      });

      const orgRef = adminDb
        .collection("organizations")
        .doc(deletionRequest.organizationId);
      batch.update(orgRef, { deletionRequestId: null });
      await batch.commit();

      return NextResponse.json(
        {
          error:
            "Confirmation link has expired. Please initiate a new deletion request.",
        },
        { status: 410 },
      );
    }

    // 6. Confirm deletion
    const now = new Date();
    const scheduledDeletionAt = new Date(
      now.getTime() + 28 * 24 * 60 * 60 * 1000,
    ); // 28 days
    const undoToken = crypto.randomUUID();
    const undoExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h undo window

    // Batch write: update request + soft-delete org
    const batch = adminDb.batch();

    batch.update(requestRef, {
      status: "confirmed-deletion",
      confirmedAt: Timestamp.fromDate(now),
      confirmedVia: "email-link",
      scheduledDeletionAt: Timestamp.fromDate(scheduledDeletionAt),
      undoToken,
      undoExpiresAt: Timestamp.fromDate(undoExpiresAt),
      auditLog: [
        ...deletionRequest.auditLog,
        {
          timestamp: Timestamp.fromDate(now),
          action: "Deletion confirmed via email link",
          userId: deletionRequest.requestedBy,
          metadata: {
            scheduledDeletionAt: scheduledDeletionAt.toISOString(),
            undoExpiresAt: undoExpiresAt.toISOString(),
          },
        },
      ],
    });

    const orgRef = adminDb
      .collection("organizations")
      .doc(deletionRequest.organizationId);
    batch.update(orgRef, {
      softDeletedAt: Timestamp.fromDate(now),
    });

    await batch.commit();

    // 7. Send alert emails to all members with org:delete permission
    // Find all members, then check for org:delete or wildcard permissions
    const membersQuery = await adminDb
      .collection("organizationMembers")
      .where("organizationId", "==", deletionRequest.organizationId)
      .get();

    const undoLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/delete-organization/undo?token=${undoToken}&requestId=${requestId}`;

    // Look up requester's display name for the alert
    const requesterDoc = await adminDb
      .collection("users")
      .doc(deletionRequest.requestedBy)
      .get();
    const confirmedByName = requesterDoc.exists
      ? requesterDoc.data()!.displayName
      : "A team member";

    for (const memberDoc of membersQuery.docs) {
      const member = memberDoc.data();

      // Check if member has org:delete permission
      // Derive permissions from role if no custom permissions set
      const customPermissions: string[] = member.permissions || [];
      const permissions: string[] = customPermissions.length > 0
        ? customPermissions
        : getPermissionsForRole(member.role as OrganizationRole).map(String);
      const hasDeletePerm =
        permissions.includes("org:delete") ||
        permissions.includes("*");

      if (hasDeletePerm && member.userId !== deletionRequest.requestedBy) {
        // Look up member's email from users collection
        const userDoc = await adminDb
          .collection("users")
          .doc(member.userId)
          .get();

        if (userDoc.exists) {
          const userData = userDoc.data()!;
          try {
            await sendDeletionAlertEmail({
              recipientEmail: userData.email,
              organizationName: deletionRequest.organizationName,
              confirmedBy: confirmedByName,
              scheduledDate: scheduledDeletionAt,
              undoUrl: undoLink,
              undoExpiresAt,
              organizationId: deletionRequest.organizationId as OrganizationId,
            });
          } catch (emailError) {
            console.error(
              `[Deletion] Failed to send alert email to ${userData.email}:`,
              emailError,
            );
          }
        }
      }
    }

    return NextResponse.json(
      {
        message: "Organisation deletion confirmed",
        scheduledDeletionAt: scheduledDeletionAt.toISOString(),
        undoExpiresAt: undoExpiresAt.toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Deletion confirmation failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
