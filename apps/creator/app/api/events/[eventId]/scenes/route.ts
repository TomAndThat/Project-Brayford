/**
 * GET  /api/events/[eventId]/scenes
 * POST /api/events/[eventId]/scenes
 *
 * Server-side endpoints for listing and creating scenes within an event.
 * Requires events:manage_modules permission.
 *
 * GET Response:
 * 200: { scenes: SceneDocument[] }
 *
 * POST Request body: {
 *   name: string,
 *   description?: string,
 *   modules?: ModuleInstance[],
 *   isTemplate?: boolean
 * }
 * POST Response:
 * 201: { sceneId: string }
 *
 * Authorization: Bearer <Firebase ID Token>
 *
 * Error responses:
 * 400: { error: string }
 * 401: { error: string }
 * 403: { error: string }
 * 404: { error: string }
 * 409: { error: string } (scene limit reached)
 * 500: { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { authenticateRequest } from "@/lib/api-auth";
import {
  hasPermission,
  EVENTS_MANAGE_MODULES,
  validateCreateSceneData,
  MAX_SCENES_PER_EVENT,
} from "@brayford/core";
import type { OrganizationMember } from "@brayford/core";

/**
 * Helper: verify the event exists and the caller has the required permission.
 * Returns the event data and caller UID on success.
 */
async function verifyEventSceneAccess(
  request: NextRequest,
  eventId: string,
): Promise<
  | { error: NextResponse }
  | { error: null; uid: string; eventData: FirebaseFirestore.DocumentData }
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

  if (!hasPermission(actorMember, EVENTS_MANAGE_MODULES)) {
    return {
      error: NextResponse.json(
        { error: "You do not have permission to manage scenes" },
        { status: 403 },
      ),
    };
  }

  // Verify user has access to the event's brand
  const hasBrandAccess =
    actorMember.brandAccess.length === 0 ||
    actorMember.brandAccess.includes(brandId);

  if (!hasBrandAccess) {
    return {
      error: NextResponse.json(
        { error: "You do not have access to this brand" },
        { status: 403 },
      ),
    };
  }

  return { error: null, uid, eventData };
}

/**
 * GET /api/events/[eventId]/scenes
 *
 * List all scenes for an event, ordered by creation date (ascending).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
): Promise<NextResponse> {
  try {
    const { eventId } = await params;

    const verification = await verifyEventSceneAccess(request, eventId);
    if (verification.error) return verification.error;

    const scenesQuery = await adminDb
      .collection("scenes")
      .where("eventId", "==", eventId)
      .orderBy("createdAt", "asc")
      .get();

    const scenes = scenesQuery.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() ?? null,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() ?? null,
    }));

    return NextResponse.json({ scenes });
  } catch (error) {
    console.error("Error listing scenes:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/events/[eventId]/scenes
 *
 * Create a new scene for an event.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
): Promise<NextResponse> {
  try {
    const { eventId } = await params;

    const verification = await verifyEventSceneAccess(request, eventId);
    if (verification.error) return verification.error;
    const { uid, eventData } = verification;

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    // Inject server-controlled fields into the body before validation
    const createPayload = {
      ...(body && typeof body === "object" ? body : {}),
      eventId,
      organizationId: eventData.organizationId,
      createdBy: uid,
    };

    let validatedData;
    try {
      validatedData = validateCreateSceneData(createPayload);
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid scene data", details: String(error) },
        { status: 400 },
      );
    }

    // Enforce per-event scene limit
    const existingCount = await adminDb
      .collection("scenes")
      .where("eventId", "==", eventId)
      .count()
      .get();

    if (existingCount.data().count >= MAX_SCENES_PER_EVENT) {
      return NextResponse.json(
        {
          error: `Scene limit reached. An event can have a maximum of ${MAX_SCENES_PER_EVENT} scenes.`,
        },
        { status: 409 },
      );
    }

    // Strip undefined values — Firestore rejects them
    const cleanData = Object.fromEntries(
      Object.entries(validatedData).filter(([, v]) => v !== undefined),
    );

    const sceneRef = adminDb.collection("scenes").doc();

    await sceneRef.set({
      ...cleanData,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json(
      { sceneId: sceneRef.id },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating scene:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
