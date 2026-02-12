/**
 * GET    /api/events/[eventId]/scenes/[sceneId]
 * PATCH  /api/events/[eventId]/scenes/[sceneId]
 * DELETE /api/events/[eventId]/scenes/[sceneId]
 *
 * Server-side endpoints for reading, updating and deleting a single scene.
 * Requires events:manage_modules permission.
 *
 * GET Response:
 * 200: { scene: SceneDocument }
 *
 * PATCH Request body: Partial<{
 *   name: string,
 *   description: string,
 *   modules: ModuleInstance[],
 *   isTemplate: boolean
 * }>
 * PATCH Response:
 * 200: { success: true }
 *
 * DELETE Response:
 * 200: { success: true }
 *
 * Authorization: Bearer <Firebase ID Token>
 *
 * Error responses:
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
  EVENTS_MANAGE_MODULES,
  validateUpdateSceneData,
} from "@brayford/core";
import type { OrganizationMember } from "@brayford/core";

type RouteParams = { params: Promise<{ eventId: string; sceneId: string }> };

/**
 * Helper: authenticate caller, verify event ownership (or template org),
 * confirm scene belongs to the event, and check permission.
 *
 * Returns the scene ref and its data on success.
 */
async function verifySceneAccess(
  request: NextRequest,
  eventId: string,
  sceneId: string,
): Promise<
  | { error: NextResponse }
  | {
      error: null;
      uid: string;
      sceneRef: FirebaseFirestore.DocumentReference;
      sceneData: FirebaseFirestore.DocumentData;
    }
> {
  const auth = await authenticateRequest(request);
  if (auth.error) return { error: auth.error };
  const { uid } = auth;

  // Fetch the event to determine the org
  const eventDoc = await adminDb.collection("events").doc(eventId).get();
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

  // Verify org membership + permission
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

  // Verify brand access
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

  // Fetch the scene and verify it belongs to this event
  const sceneRef = adminDb.collection("scenes").doc(sceneId);
  const sceneDoc = await sceneRef.get();

  if (!sceneDoc.exists) {
    return {
      error: NextResponse.json(
        { error: "Scene not found" },
        { status: 404 },
      ),
    };
  }

  const sceneData = sceneDoc.data()!;
  if (sceneData.eventId !== eventId) {
    return {
      error: NextResponse.json(
        { error: "Scene does not belong to this event" },
        { status: 404 },
      ),
    };
  }

  return { error: null, uid, sceneRef, sceneData };
}

/**
 * GET /api/events/[eventId]/scenes/[sceneId]
 *
 * Retrieve a single scene.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const { eventId, sceneId } = await params;

    const verification = await verifySceneAccess(request, eventId, sceneId);
    if (verification.error) return verification.error;
    const { sceneData } = verification;

    const scene = {
      id: sceneId,
      ...sceneData,
      createdAt: sceneData.createdAt?.toDate?.()?.toISOString() ?? null,
      updatedAt: sceneData.updatedAt?.toDate?.()?.toISOString() ?? null,
    };

    return NextResponse.json({ scene });
  } catch (error) {
    console.error("Error fetching scene:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/events/[eventId]/scenes/[sceneId]
 *
 * Update a scene's name, description, modules, or template status.
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const { eventId, sceneId } = await params;

    const verification = await verifySceneAccess(request, eventId, sceneId);
    if (verification.error) return verification.error;
    const { sceneRef } = verification;

    // Parse body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    let validatedData;
    try {
      validatedData = validateUpdateSceneData(body);
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid scene data", details: String(error) },
        { status: 400 },
      );
    }

    // Strip undefined values
    const cleanData = Object.fromEntries(
      Object.entries(validatedData).filter(([, v]) => v !== undefined),
    );

    if (Object.keys(cleanData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    await sceneRef.update({
      ...cleanData,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating scene:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/events/[eventId]/scenes/[sceneId]
 *
 * Permanently delete a scene document.
 *
 * If this scene is currently active in the event's live state,
 * the active scene is cleared (set to null) to avoid a broken reference.
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const { eventId, sceneId } = await params;

    const verification = await verifySceneAccess(request, eventId, sceneId);
    if (verification.error) return verification.error;
    const { sceneRef } = verification;

    // If this scene is currently active, clear the live state
    const liveStateRef = adminDb.doc(`events/${eventId}/live/state`);
    const liveStateDoc = await liveStateRef.get();

    if (liveStateDoc.exists && liveStateDoc.data()?.activeSceneId === sceneId) {
      await liveStateRef.update({
        activeSceneId: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await sceneRef.delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting scene:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
