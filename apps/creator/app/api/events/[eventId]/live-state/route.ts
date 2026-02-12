/**
 * GET   /api/events/[eventId]/live-state
 * POST  /api/events/[eventId]/live-state
 * PATCH /api/events/[eventId]/live-state
 *
 * Server-side endpoints for managing event live state.
 * Controls what audience devices currently display.
 *
 * GET: Read current live state (requires events:manage_modules permission).
 * POST: Initialise live state document for a new event.
 * PATCH: Switch active scene or mark scene content as updated.
 *
 * Document path: /events/{eventId}/live/state
 *
 * GET Response:
 * 200: { liveState: EventLiveState | null }
 *
 * POST Response:
 * 201: { success: true }
 * 200: { success: true, message: "Already initialised" }
 *
 * PATCH Request body: {
 *   action: "switchScene",
 *   sceneId: string | null    // null clears the active scene
 * } | {
 *   action: "markContentUpdated"
 * }
 * PATCH Response:
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
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { authenticateRequest } from "@/lib/api-auth";
import {
  hasPermission,
  EVENTS_MANAGE_MODULES,
} from "@brayford/core";
import type { OrganizationMember } from "@brayford/core";

type RouteParams = { params: Promise<{ eventId: string }> };

/**
 * Helper: authenticate caller and verify events:manage_modules permission
 * for the event's organisation.
 */
async function verifyLiveStateAccess(
  request: NextRequest,
  eventId: string,
): Promise<
  | { error: NextResponse }
  | { error: null; uid: string; eventData: FirebaseFirestore.DocumentData }
> {
  const auth = await authenticateRequest(request);
  if (auth.error) return { error: auth.error };
  const { uid } = auth;

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
        { error: "You do not have permission to manage live state" },
        { status: 403 },
      ),
    };
  }

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
 * GET /api/events/[eventId]/live-state
 *
 * Read the current live state for an event.
 * Returns null if the live state has not been initialised yet.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const { eventId } = await params;

    const verification = await verifyLiveStateAccess(request, eventId);
    if (verification.error) return verification.error;

    const stateRef = adminDb.doc(`events/${eventId}/live/state`);
    const stateDoc = await stateRef.get();

    if (!stateDoc.exists) {
      return NextResponse.json({ liveState: null });
    }

    const data = stateDoc.data()!;
    return NextResponse.json({
      liveState: {
        activeSceneId: data.activeSceneId ?? null,
        sceneUpdatedAt: data.sceneUpdatedAt?.toDate?.()?.toISOString() ?? null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("Error reading live state:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/events/[eventId]/live-state
 *
 * Initialise the live state document. Safe to call multiple times —
 * if the document already exists it returns 200 without overwriting.
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const { eventId } = await params;

    const verification = await verifyLiveStateAccess(request, eventId);
    if (verification.error) return verification.error;

    const stateRef = adminDb.doc(`events/${eventId}/live/state`);
    const stateDoc = await stateRef.get();

    if (stateDoc.exists) {
      return NextResponse.json({
        success: true,
        message: "Already initialised",
      });
    }

    await stateRef.set({
      activeSceneId: null,
      sceneUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json(
      { success: true },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error initialising live state:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/events/[eventId]/live-state
 *
 * Two actions:
 *
 * 1. switchScene — Sets the active scene (or clears it with null).
 *    Also appends to the event's sceneHistory array for analytics.
 *
 * 2. markContentUpdated — Bumps sceneUpdatedAt so audience devices
 *    know to re-fetch the active scene's data.
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const { eventId } = await params;

    const verification = await verifyLiveStateAccess(request, eventId);
    if (verification.error) return verification.error;
    const { uid } = verification;

    // Parse body
    let body: Record<string, unknown>;
    try {
      const raw = await request.json();
      if (!raw || typeof raw !== "object") {
        throw new Error("Body must be an object");
      }
      body = raw as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    const { action } = body;

    if (action === "switchScene") {
      return await handleSwitchScene(eventId, body, uid);
    }

    if (action === "markContentUpdated") {
      return await handleMarkContentUpdated(eventId);
    }

    return NextResponse.json(
      {
        error:
          'Invalid action. Must be "switchScene" or "markContentUpdated".',
      },
      { status: 400 },
    );
  } catch (error) {
    console.error("Error updating live state:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ===== Action Handlers =====

async function handleSwitchScene(
  eventId: string,
  body: Record<string, unknown>,
  uid: string,
): Promise<NextResponse> {
  const { sceneId } = body;

  // sceneId must be a string or null
  if (sceneId !== null && typeof sceneId !== "string") {
    return NextResponse.json(
      { error: "sceneId must be a string or null" },
      { status: 400 },
    );
  }

  // If activating a scene, verify it exists and belongs to this event's org
  if (typeof sceneId === "string") {
    const sceneDoc = await adminDb.collection("scenes").doc(sceneId).get();
    if (!sceneDoc.exists) {
      return NextResponse.json(
        { error: "Scene not found" },
        { status: 404 },
      );
    }
    // Scene must belong to the same org as the event
    const eventDoc = await adminDb.collection("events").doc(eventId).get();
    const eventOrgId = eventDoc.data()?.organizationId;
    if (sceneDoc.data()?.organizationId !== eventOrgId) {
      return NextResponse.json(
        { error: "Scene does not belong to this organisation" },
        { status: 400 },
      );
    }
  }

  // Verify live state is initialised
  const stateRef = adminDb.doc(`events/${eventId}/live/state`);
  const stateDoc = await stateRef.get();

  if (!stateDoc.exists) {
    return NextResponse.json(
      { error: "Live state has not been initialised. Call POST first." },
      { status: 400 },
    );
  }

  // Update the live state
  await stateRef.update({
    activeSceneId: sceneId,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Append to event's sceneHistory for analytics (only when activating, not clearing)
  if (typeof sceneId === "string") {
    const eventRef = adminDb.collection("events").doc(eventId);
    await eventRef.update({
      sceneHistory: FieldValue.arrayUnion({
        sceneId,
        switchedAt: Timestamp.now(),
        switchedBy: uid,
      }),
    });
  }

  return NextResponse.json({ success: true });
}

async function handleMarkContentUpdated(
  eventId: string,
): Promise<NextResponse> {
  const stateRef = adminDb.doc(`events/${eventId}/live/state`);
  const stateDoc = await stateRef.get();

  if (!stateDoc.exists) {
    return NextResponse.json(
      { error: "Live state has not been initialised. Call POST first." },
      { status: 400 },
    );
  }

  await stateRef.update({
    sceneUpdatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ success: true });
}
