/**
 * POST /api/sandbox/reset
 *
 * Performs a soft reset of the sandbox event for the caller's organisation.
 *
 * A soft reset clears all transient interaction data while preserving the
 * event's scene and module configuration, so users can run repeated training
 * sessions without re-configuring everything from scratch each time.
 *
 * Clears:
 * - All audience sessions (marks isActive: false)
 * - All messages for the event (marks isDeleted: true, soft delete)
 * - Message column entry subcollections (cleared)
 * - Message column messageCount counters (reset to zero)
 *
 * Preserves:
 * - Scenes and module configuration
 * - QR codes
 * - The event document itself
 *
 * Authorization: Bearer <Firebase ID Token>
 *
 * Request body: { organizationId: string }
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
import { FieldValue } from "firebase-admin/firestore";
import { authenticateRequest } from "@/lib/api-auth";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Authenticate caller
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    const { uid } = auth;

    // 2. Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    const bodyObj =
      body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const organizationId = bodyObj.organizationId;

    if (!organizationId || typeof organizationId !== "string") {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 },
      );
    }

    // 3. Verify caller is a member of the organisation
    const memberQuery = await adminDb
      .collection("organizationMembers")
      .where("organizationId", "==", organizationId)
      .where("userId", "==", uid)
      .limit(1)
      .get();

    if (memberQuery.empty) {
      return NextResponse.json(
        { error: "You are not a member of this organisation" },
        { status: 403 },
      );
    }

    // 4. Fetch org to get testEventId
    const orgDoc = await adminDb.collection("organizations").doc(organizationId).get();

    if (!orgDoc.exists) {
      return NextResponse.json(
        { error: "Organisation not found" },
        { status: 404 },
      );
    }

    const testEventId = orgDoc.data()?.testEventId as string | undefined;

    if (!testEventId) {
      return NextResponse.json(
        { error: "No sandbox event found for this organisation" },
        { status: 404 },
      );
    }

    // 5. Verify this event is actually a sandbox event (safety check)
    const eventDoc = await adminDb.collection("events").doc(testEventId).get();
    if (!eventDoc.exists || !eventDoc.data()?.isSandbox) {
      return NextResponse.json(
        { error: "Sandbox event not found or is not a sandbox event" },
        { status: 404 },
      );
    }

    // 6. Deactivate all active audience sessions for this event
    const activeSessions = await adminDb
      .collection("audienceSessions")
      .where("eventId", "==", testEventId)
      .where("isActive", "==", true)
      .get();

    // 7. Soft-delete all messages for this event
    const messages = await adminDb
      .collection("messages")
      .where("eventId", "==", testEventId)
      .get();

    // 8. Clear message column entry subcollections and reset counters
    const messageColumns = await adminDb
      .collection("messageColumns")
      .where("eventId", "==", testEventId)
      .get();

    // Fetch all column entry subcollections in parallel
    const columnEntrySnapshots = await Promise.all(
      messageColumns.docs.map((col) =>
        adminDb.collection("messageColumns").doc(col.id).collection("messages").get()
      )
    );

    // Process in batches of 500 (Firestore batch limit)
    const BATCH_SIZE = 500;
    let currentBatch = adminDb.batch();
    let writeCount = 0;
    const batches = [currentBatch];

    const addWrite = (fn: (batch: FirebaseFirestore.WriteBatch) => void) => {
      if (writeCount >= BATCH_SIZE) {
        currentBatch = adminDb.batch();
        batches.push(currentBatch);
        writeCount = 0;
      }
      fn(currentBatch);
      writeCount++;
    };

    // Deactivate sessions
    for (const sessionDoc of activeSessions.docs) {
      addWrite((batch) =>
        batch.update(sessionDoc.ref, { isActive: false, updatedAt: FieldValue.serverTimestamp() })
      );
    }

    // Soft-delete messages
    for (const messageDoc of messages.docs) {
      addWrite((batch) =>
        batch.update(messageDoc.ref, {
          isDeleted: true,
          deletedAt: FieldValue.serverTimestamp(),
        })
      );
    }

    // Clear column entry subcollections and reset counters
    for (let i = 0; i < messageColumns.docs.length; i++) {
      const columnDoc = messageColumns.docs[i]!;
      const entrySnap = columnEntrySnapshots[i]!;

      // Delete each entry in the subcollection
      for (const entryDoc of entrySnap.docs) {
        addWrite((batch) => batch.delete(entryDoc.ref));
      }

      // Reset the column message counter (but keep the column itself)
      addWrite((batch) =>
        batch.update(columnDoc.ref, {
          messageCount: 0,
          updatedAt: FieldValue.serverTimestamp(),
        })
      );
    }

    // Commit all batches sequentially
    for (const batch of batches) {
      await batch.commit();
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error resetting sandbox event:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
