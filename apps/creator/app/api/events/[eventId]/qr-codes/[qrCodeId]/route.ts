/**
 * PATCH /api/events/[eventId]/qr-codes/[qrCodeId]
 * DELETE /api/events/[eventId]/qr-codes/[qrCodeId]
 *
 * Server-side endpoints for updating and deleting QR codes.
 *
 * PATCH: Requires events:update permission. Updates QR code fields (name, isActive).
 * DELETE: Requires events:update permission. Soft-deletes (sets isActive = false).
 *
 * Authorization: Bearer <Firebase ID Token>
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
import { authenticateRequest } from "@/lib/api-auth";
import {
  hasPermission,
  EVENTS_UPDATE,
} from "@brayford/core";
import type { OrganizationMember } from "@brayford/core";

/**
 * Helper: verify QR code belongs to event and user has permission
 */
async function verifyQRCodePermission(
  request: NextRequest,
  eventId: string,
  qrCodeId: string,
): Promise<
  | { error: NextResponse }
  | { error: null; qrCodeRef: FirebaseFirestore.DocumentReference }
> {
  const auth = await authenticateRequest(request);
  if (auth.error) return { error: auth.error };
  const { uid } = auth;

  // Verify QR code exists and belongs to event
  const qrCodeRef = adminDb.collection("qrCodes").doc(qrCodeId);
  const qrCodeDoc = await qrCodeRef.get();

  if (!qrCodeDoc.exists) {
    return {
      error: NextResponse.json(
        { error: "QR code not found" },
        { status: 404 },
      ),
    };
  }

  const qrCodeData = qrCodeDoc.data()!;

  if (qrCodeData.eventId !== eventId) {
    return {
      error: NextResponse.json(
        { error: "QR code does not belong to this event" },
        { status: 403 },
      ),
    };
  }

  const { organizationId, eventId: qrEventId } = qrCodeData;

  // Verify event exists
  const eventDoc = await adminDb.collection("events").doc(qrEventId).get();
  if (!eventDoc.exists) {
    return {
      error: NextResponse.json(
        { error: "Event not found" },
        { status: 404 },
      ),
    };
  }

  const eventData = eventDoc.data()!;
  const brandId = eventData.brandId;

  // Verify user is org member with events:update permission
  const memberQuery = await adminDb
    .collection("organizationMembers")
    .where("organizationId", "==", organizationId)
    .where("userId", "==", uid)
    .limit(1)
    .get();

  if (memberQuery.empty) {
    return {
      error: NextResponse.json(
        { error: "You are not a member of this organisation" },
        { status: 403 },
      ),
    };
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
    return {
      error: NextResponse.json(
        { error: "You do not have the required permission" },
        { status: 403 },
      ),
    };
  }

  // Verify user has access to the brand
  const hasBrandAccess =
    actorMember.brandAccess.length === 0 || // Empty array = access to all
    actorMember.brandAccess.includes(brandId);

  if (!hasBrandAccess) {
    return {
      error: NextResponse.json(
        { error: "You do not have access to this brand" },
        { status: 403 },
      ),
    };
  }

  return { error: null, qrCodeRef };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; qrCodeId: string }> },
): Promise<NextResponse> {
  try {
    const { eventId, qrCodeId } = await params;

    // Verify permission
    const verification = await verifyQRCodePermission(
      request,
      eventId,
      qrCodeId,
    );
    if (verification.error) return verification.error;
    const { qrCodeRef } = verification;

    // Parse and validate body
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

    const updateData = body as Record<string, unknown>;
    const cleanData: Record<string, unknown> = {};

    // Validate name if provided
    if ("name" in updateData) {
      if (typeof updateData.name !== "string" || updateData.name.trim().length === 0) {
        return NextResponse.json(
          { error: "QR code name must be a non-empty string" },
          { status: 400 },
        );
      }
      if (updateData.name.trim().length > 100) {
        return NextResponse.json(
          { error: "QR code name must be 100 characters or less" },
          { status: 400 },
        );
      }
      cleanData.name = updateData.name.trim();
    }

    // Validate isActive if provided
    if ("isActive" in updateData) {
      if (typeof updateData.isActive !== "boolean") {
        return NextResponse.json(
          { error: "isActive must be a boolean" },
          { status: 400 },
        );
      }
      cleanData.isActive = updateData.isActive;
    }

    if (Object.keys(cleanData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    await qrCodeRef.update(cleanData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating QR code:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; qrCodeId: string }> },
): Promise<NextResponse> {
  try {
    const { eventId, qrCodeId } = await params;

    // Verify permission
    const verification = await verifyQRCodePermission(
      request,
      eventId,
      qrCodeId,
    );
    if (verification.error) return verification.error;
    const { qrCodeRef } = verification;

    // Soft delete: set isActive to false
    await qrCodeRef.update({ isActive: false });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting QR code:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
