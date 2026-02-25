/**
 * POST /api/sandbox/open
 *
 * Opens (or creates) the sandbox test event for the caller's organisation.
 *
 * The sandbox event is a permanent, always-live event per organisation that:
 * - Lives under a hidden system brand (isSystem: true)
 * - Is flagged isSandbox: true so billing metering skips it
 * - Is always status: 'live' — no start/end cycle
 * - Has a hard cap of 100 audience members
 * - Uses a far-future sentinel scheduled date (the date has no semantic value)
 *
 * Idempotent: if the org already has a testEventId, the event is returned
 * immediately (after ensuring its status is 'live'). On first call, the full
 * scaffold (system brand + event + QR code + inbox column) is created atomically.
 *
 * Authorization: Bearer <Firebase ID Token>
 *
 * Request body: { organizationId: string }
 *
 * Response:
 * 200: { eventId: string }
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
import { generateQRCode, DEFAULT_INBOX_COLUMN_NAME } from "@brayford/core";

// Sentinel scheduled date — far future, carries no semantic meaning for sandbox events.
const SANDBOX_SCHEDULED_DATE = new Date("2099-12-31T00:00:00.000Z");
const SANDBOX_AUDIENCE_CAP = 100;

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

    // 4. Fetch organisation to check for existing sandbox event
    const orgDoc = await adminDb.collection("organizations").doc(organizationId).get();

    if (!orgDoc.exists) {
      return NextResponse.json(
        { error: "Organisation not found" },
        { status: 404 },
      );
    }

    const orgData = orgDoc.data()!;

    // 5. If sandbox event already exists, ensure it is live and return it
    if (orgData.testEventId) {
      const existingEventId = orgData.testEventId as string;
      const existingEventDoc = await adminDb
        .collection("events")
        .doc(existingEventId)
        .get();

      if (existingEventDoc.exists) {
        const existingEvent = existingEventDoc.data()!;
        // Re-activate if somehow the status was changed
        if (existingEvent.status !== "live") {
          await adminDb
            .collection("events")
            .doc(existingEventId)
            .update({ status: "live" });
        }
        return NextResponse.json({ eventId: existingEventId }, { status: 200 });
      }
      // If the event document is missing (shouldn't happen), fall through to recreate
    }

    // 6. First time: create the full sandbox scaffold in a batch write

    // 6a. Create system brand ("Sandbox")
    const sandboxBrandRef = adminDb.collection("brands").doc();

    // 6b. Create sandbox event
    const sandboxEventRef = adminDb.collection("events").doc();

    // 6c. Create QR code for the sandbox event
    const sandboxQRCodeRef = adminDb.collection("qrCodes").doc();
    const qrCode = generateQRCode();

    // 6d. Create default inbox message column
    const sandboxInboxColumnRef = adminDb.collection("messageColumns").doc();

    const batch = adminDb.batch();

    batch.set(sandboxBrandRef, {
      organizationId,
      name: "Sandbox",
      isActive: true,
      isSystem: true, // Hidden from normal brand listings
      createdAt: FieldValue.serverTimestamp(),
    });

    batch.set(sandboxEventRef, {
      brandId: sandboxBrandRef.id,
      organizationId,
      name: "Test Event",
      eventType: "event",
      // Sentinel date — carries no semantic meaning for a sandbox event
      scheduledDate: SANDBOX_SCHEDULED_DATE,
      scheduledStartTime: "00:00",
      timezone: "UTC",
      status: "live", // Always live
      isActive: true,
      isSandbox: true,
      maxAttendees: SANDBOX_AUDIENCE_CAP,
      createdAt: FieldValue.serverTimestamp(),
    });

    batch.set(sandboxQRCodeRef, {
      eventId: sandboxEventRef.id,
      organizationId,
      code: qrCode,
      name: "Sandbox QR Code",
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
    });

    batch.set(sandboxInboxColumnRef, {
      eventId: sandboxEventRef.id,
      organizationId,
      brandId: sandboxBrandRef.id,
      name: DEFAULT_INBOX_COLUMN_NAME,
      order: 0,
      isDefault: true,
      isBin: false,
      messageCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Write testEventId back to the organisation document
    batch.update(orgDoc.ref, {
      testEventId: sandboxEventRef.id,
    });

    await batch.commit();

    return NextResponse.json(
      { eventId: sandboxEventRef.id },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error opening sandbox event:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
