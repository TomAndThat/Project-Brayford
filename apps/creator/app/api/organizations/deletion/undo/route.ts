/**
 * POST /api/organizations/deletion/undo
 * 
 * Undoes a confirmed organization deletion within the 24-hour window.
 * 
 * Flow:
 * 1. Validate undo token and request ID
 * 2. Check undo window hasn't expired (24h)
 * 3. Verify caller has org:delete permission
 * 4. Cancel deletion, clear soft-delete marker
 * 5. Log to audit trail
 * 
 * Request body:
 * - token: string (undo token from alert email)
 * - requestId: string (deletion request document ID)
 * 
 * Authorization: Bearer <Firebase ID Token>
 * 
 * Response:
 * 200: { message: string }
 * 400: { error: string }
 * 401: { error: string }
 * 403: { error: string }
 * 404: { error: string }
 * 410: { error: string } (window expired)
 * 500: { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
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

    // 2. Parse request body
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

    // 3. Fetch deletion request
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

    // 4. Validate undo token
    if (deletionRequest.undoToken !== token) {
      return NextResponse.json(
        { error: "Invalid undo token" },
        { status: 400 },
      );
    }

    // 5. Check status is confirmed-deletion (can only undo confirmed requests)
    if (deletionRequest.status !== "confirmed-deletion") {
      return NextResponse.json(
        {
          error: `Cannot undo — request status is ${deletionRequest.status}`,
        },
        { status: 400 },
      );
    }

    // 6. Check undo window
    const undoExpiresAt =
      deletionRequest.undoExpiresAt instanceof Timestamp
        ? deletionRequest.undoExpiresAt.toDate()
        : new Date(deletionRequest.undoExpiresAt);

    if (new Date() > undoExpiresAt) {
      return NextResponse.json(
        {
          error:
            "The undo window has expired. The organisation is scheduled for deletion.",
        },
        { status: 410 },
      );
    }

    // 7. Verify caller has org:delete permission
    const memberQuery = await adminDb
      .collection("organizationMembers")
      .where("organizationId", "==", deletionRequest.organizationId)
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
    const permissions: string[] = memberData.permissions || [];
    const hasDeletePerm =
      permissions.includes("org:delete") ||
      permissions.includes("*") ||
      (permissions.length === 0 && memberData.role === "owner");

    if (!hasDeletePerm) {
      return NextResponse.json(
        { error: "You do not have permission to undo this deletion" },
        { status: 403 },
      );
    }

    // 8. Undo deletion
    const now = new Date();
    const batch = adminDb.batch();

    batch.update(requestRef, {
      status: "cancelled",
      auditLog: [
        ...deletionRequest.auditLog,
        {
          timestamp: Timestamp.fromDate(now),
          action: "Deletion undone",
          userId,
          metadata: {
            undoneByUserId: userId,
            undoneAt: now.toISOString(),
          },
        },
      ],
    });

    const orgRef = adminDb
      .collection("organizations")
      .doc(deletionRequest.organizationId);
    batch.update(orgRef, {
      softDeletedAt: null,
      deletionRequestId: null,
    });

    await batch.commit();

    console.log(
      `[Deletion] Organisation ${deletionRequest.organizationName} deletion undone by user ${userId}`,
    );

    return NextResponse.json(
      {
        message: `Deletion of ${deletionRequest.organizationName} has been cancelled.`,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Deletion undo failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
