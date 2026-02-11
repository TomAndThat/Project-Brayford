/**
 * POST /api/events/[eventId]/qr-codes
 *
 * Server-side endpoint for creating QR codes for an event.
 * Requires events:update permission.
 *
 * Request body: {
 *   name: string
 * }
 * Authorization: Bearer <Firebase ID Token>
 *
 * Response:
 * 201: { qrCodeId: string }
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
import {
  hasPermission,
  EVENTS_UPDATE,
  generateQRCode,
} from "@brayford/core";
import type { OrganizationMember } from "@brayford/core";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
): Promise<NextResponse> {
  try {
    const { eventId } = await params;

    // 1. Authenticate
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    const { uid } = auth;

    // 2. Parse and validate body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Request body must be an object" },
        { status: 400 },
      );
    }

    const { name } = body as Record<string, unknown>;

    if (typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "QR code name is required" },
        { status: 400 },
      );
    }

    if (name.trim().length > 100) {
      return NextResponse.json(
        { error: "QR code name must be 100 characters or less" },
        { status: 400 },
      );
    }

    // 3. Verify event exists
    const eventRef = adminDb.collection("events").doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 },
      );
    }

    const eventData = eventDoc.data()!;
    const { organizationId, brandId } = eventData;

    // 4. Verify caller has events:update permission
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

    const memberData = memberQuery.docs[0]!.data();
    const actorMember = {
      organizationId: memberData.organizationId,
      userId: memberData.userId,
      role: memberData.role,
      permissions: memberData.permissions || [],
      brandAccess: memberData.brandAccess || [],
    } as OrganizationMember;

    if (!hasPermission(actorMember, EVENTS_UPDATE)) {
      return NextResponse.json(
        { error: "You do not have permission to update events" },
        { status: 403 },
      );
    }

    // 5. Verify user has access to the brand
    const hasBrandAccess =
      actorMember.brandAccess.length === 0 || // Empty array = access to all
      actorMember.brandAccess.includes(brandId);

    if (!hasBrandAccess) {
      return NextResponse.json(
        { error: "You do not have access to this brand" },
        { status: 403 },
      );
    }

    // 6. Create the QR code
    const qrCodeRef = adminDb.collection("qrCodes").doc();
    const code = generateQRCode();

    await qrCodeRef.set({
      eventId,
      organizationId,
      code,
      name: name.trim(),
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json(
      { qrCodeId: qrCodeRef.id },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating QR code:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
