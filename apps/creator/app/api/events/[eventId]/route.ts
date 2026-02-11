/**
 * PATCH /api/events/[eventId]
 * DELETE /api/events/[eventId]
 *
 * Server-side endpoints for updating and soft-deleting events.
 *
 * PATCH: Requires events:update permission. Updates event fields.
 * DELETE: Requires events:delete permission. Soft-deletes (sets isActive = false).
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
  EVENTS_DELETE,
  validateUpdateEventData,
} from "@brayford/core";
import type { OrganizationMember, Permission } from "@brayford/core";

/**
 * Helper: fetch event and verify caller has the required permission
 */
async function verifyEventPermission(
  request: NextRequest,
  eventId: string,
  requiredPermission: Permission,
): Promise<
  | { error: NextResponse }
  | { error: null; eventRef: FirebaseFirestore.DocumentReference }
> {
  const auth = await authenticateRequest(request);
  if (auth.error) return { error: auth.error };
  const { uid } = auth;

  const eventRef = adminDb.collection("events").doc(eventId);
  const eventDoc = await eventRef.get();

  if (!eventDoc.exists) {
    return {
      error: NextResponse.json(
        { error: "Event not found" },
        { status: 404 },
      ),
    };
  }

  const eventData = eventDoc.data()!;
  const { organizationId, brandId } = eventData;

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

  if (!hasPermission(actorMember, requiredPermission)) {
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

  return { error: null, eventRef };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
): Promise<NextResponse> {
  try {
    const { eventId } = await params;

    // Verify permission
    const verification = await verifyEventPermission(
      request,
      eventId,
      EVENTS_UPDATE,
    );
    if (verification.error) return verification.error;
    const { eventRef } = verification;

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
      validatedData = validateUpdateEventData(bodyWithDates);
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid event data", details: String(error) },
        { status: 400 },
      );
    }

    // Strip undefined values
    const cleanData = Object.fromEntries(
      Object.entries(validatedData).filter(([, v]) => v !== undefined),
    );

    await eventRef.update(cleanData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating event:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
): Promise<NextResponse> {
  try {
    const { eventId } = await params;

    // Verify permission
    const verification = await verifyEventPermission(
      request,
      eventId,
      EVENTS_DELETE,
    );
    if (verification.error) return verification.error;
    const { eventRef } = verification;

    // Soft delete: set isActive to false
    await eventRef.update({ isActive: false });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting event:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
