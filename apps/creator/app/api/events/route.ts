/**
 * POST /api/events
 *
 * Server-side endpoint for creating an event within a brand.
 * Requires events:create permission.
 *
 * Request body: {
 *   brandId: string,
 *   organizationId: string,
 *   name: string,
 *   venue?: string,
 *   scheduledDate: string (ISO date),
 *   scheduledStartTime: string (HH:MM),
 *   scheduledEndDate?: string (ISO date),
 *   scheduledEndTime?: string (HH:MM),
 *   timezone: string (IANA identifier)
 * }
 * Authorization: Bearer <Firebase ID Token>
 *
 * Response:
 * 201: { eventId: string }
 * 400: { error: string }
 * 401: { error: string }
 * 403: { error: string }
 * 500: { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { authenticateRequest } from "@/lib/api-auth";
import {
  hasPermission,
  EVENTS_CREATE,
  validateCreateEventData,
  generateQRCode,
} from "@brayford/core";
import type { OrganizationMember } from "@brayford/core";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
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

    // Convert date strings to Date objects for validation
    const bodyObj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const bodyWithDates =
      body && typeof body === "object"
        ? {
            ...bodyObj,
            scheduledDate:
              typeof bodyObj.scheduledDate === "string"
                ? new Date(bodyObj.scheduledDate)
                : bodyObj.scheduledDate,
            scheduledEndDate:
              typeof bodyObj.scheduledEndDate === "string"
                ? new Date(bodyObj.scheduledEndDate)
                : bodyObj.scheduledEndDate,
          }
        : body;

    let validatedData;
    try {
      validatedData = validateCreateEventData(bodyWithDates);
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid event data", details: String(error) },
        { status: 400 },
      );
    }

    const { brandId, organizationId } = validatedData;

    // 3. Verify brand exists
    const brandDoc = await adminDb.collection("brands").doc(brandId).get();
    if (!brandDoc.exists) {
      return NextResponse.json(
        { error: "Brand not found" },
        { status: 404 },
      );
    }

    // 4. Verify caller has events:create permission
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

    if (!hasPermission(actorMember, EVENTS_CREATE)) {
      return NextResponse.json(
        { error: "You do not have permission to create events" },
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

    // 6. Create the event
    const eventRef = adminDb.collection("events").doc();

    // Strip undefined values
    const cleanData = Object.fromEntries(
      Object.entries(validatedData).filter(([, v]) => v !== undefined),
    );

    await eventRef.set({
      ...cleanData,
      createdAt: FieldValue.serverTimestamp(),
      status: "draft",
      isActive: true,
    });

    // 7. Create default QR code for the event
    const qrCodeRef = adminDb.collection("qrCodes").doc();
    const code = generateQRCode();

    await qrCodeRef.set({
      eventId: eventRef.id,
      organizationId,
      code,
      name: "Main QR Code",
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json(
      { eventId: eventRef.id },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating event:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
