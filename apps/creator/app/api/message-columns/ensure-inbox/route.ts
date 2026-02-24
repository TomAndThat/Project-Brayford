/**
 * POST /api/message-columns/ensure-inbox
 *
 * Idempotent endpoint that guarantees a default inbox column exists for a
 * given event. If one already exists it returns its ID without creating a
 * duplicate. Used as a client-side fallback for events created before the
 * server-side inbox step was added, or if the inbox was accidentally deleted.
 *
 * Requires events:manage_modules permission on the event's organisation.
 *
 * Request body: {
 *   eventId: string,
 *   organizationId: string,
 *   brandId: string,
 * }
 *
 * Response:
 * 200: { columnId: string, created: boolean }
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
  hasBrandAccess,
  EVENTS_MANAGE_MODULES,
  DEFAULT_INBOX_COLUMN_NAME,
} from "@brayford/core";
import type { OrganizationMember } from "@brayford/core";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Authenticate
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    const { uid } = auth;

    // 2. Parse body
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    const { eventId, organizationId, brandId } = body;

    if (
      typeof eventId !== "string" ||
      typeof organizationId !== "string" ||
      typeof brandId !== "string"
    ) {
      return NextResponse.json(
        { error: "eventId, organizationId, and brandId are required strings" },
        { status: 400 },
      );
    }

    // 3. Verify caller has events:manage_modules permission
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

    if (!hasPermission(actorMember, EVENTS_MANAGE_MODULES)) {
      return NextResponse.json(
        { error: "You do not have permission to manage event modules" },
        { status: 403 },
      );
    }

    // Verify user has access to the supplied brand
    if (!hasBrandAccess(actorMember, brandId)) {
      return NextResponse.json(
        { error: "You do not have access to this brand" },
        { status: 403 },
      );
    }

    // 4. Check if a default inbox column already exists for this event
    const existingQuery = await adminDb
      .collection("messageColumns")
      .where("eventId", "==", eventId)
      .where("isDefault", "==", true)
      .limit(1)
      .get();

    if (!existingQuery.empty) {
      return NextResponse.json(
        { columnId: existingQuery.docs[0]!.id, created: false },
        { status: 200 },
      );
    }

    // 5. Create the default inbox column
    const columnRef = adminDb.collection("messageColumns").doc();

    await columnRef.set({
      eventId,
      organizationId,
      brandId,
      name: DEFAULT_INBOX_COLUMN_NAME,
      order: 0,
      isDefault: true,
      isBin: false,
      messageCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json(
      { columnId: columnRef.id, created: true },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error ensuring inbox column:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
