/**
 * GET  /api/scenes
 * POST /api/scenes
 *
 * List all scenes for the authenticated user's organization, or create a new scene.
 * Requires events:manage_modules permission.
 *
 * GET Response:
 * 200: { scenes: SceneDocument[] }
 *
 * POST Request body: {
 *   organizationId: string,
 *   name: string,
 *   description?: string,
 *   modules?: ModuleInstance[],
 *   brandId?: string | null,
 *   eventId?: string | null,
 *   createdBy: string
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
} from "@brayford/core";
import type { OrganizationMember } from "@brayford/core";

/**
 * GET /api/scenes
 *
 * List all scenes for the user's organization, ordered by creation date.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate
    const authResult = await authenticateRequest(request);
    if (authResult.error) {
      return authResult.error;
    }
    const { uid } = authResult;

    // Find user's organization membership
    const memberQuery = await adminDb
      .collection("organizationMembers")
      .where("userId", "==", uid)
      .limit(1)
      .get();

    if (memberQuery.empty) {
      return NextResponse.json(
        { error: "Organisation membership not found" },
        { status: 404 },
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

    // Check permission
    if (!hasPermission(actorMember, EVENTS_MANAGE_MODULES)) {
      return NextResponse.json(
        { error: "You do not have permission to manage scenes" },
        { status: 403 },
      );
    }

    // Fetch all scenes for the organization
    const scenesSnapshot = await adminDb
      .collection("scenes")
      .where("organizationId", "==", actorMember.organizationId)
      .orderBy("createdAt", "asc")
      .get();

    const scenes = scenesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore timestamps to ISO strings
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
    }));

    return NextResponse.json({ scenes }, { status: 200 });
  } catch (error) {
    console.error("Error fetching scenes:", error);
    return NextResponse.json(
      { error: "Failed to fetch scenes" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/scenes
 *
 * Create a new scene for the organization.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate
    const authResult = await authenticateRequest(request);
    if (authResult.error) {
      return authResult.error;
    }
    const { uid } = authResult;

    // Parse request body
    const body = await request.json();
    let sceneData;
    try {
      sceneData = validateCreateSceneData(body);
    } catch (validationError) {
      console.error("Scene validation error:", validationError);
      return NextResponse.json(
        { error: "Invalid scene data" },
        { status: 400 },
      );
    }

    // Find user's organization membership
    const memberQuery = await adminDb
      .collection("organizationMembers")
      .where("userId", "==", uid)
      .where("organizationId", "==", sceneData.organizationId)
      .limit(1)
      .get();

    if (memberQuery.empty) {
      return NextResponse.json(
        { error: "Organisation membership not found" },
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

    // Check permission
    if (!hasPermission(actorMember, EVENTS_MANAGE_MODULES)) {
      return NextResponse.json(
        { error: "You do not have permission to manage scenes" },
        { status: 403 },
      );
    }

    // If brandId is set, verify user has access
    if (sceneData.brandId && actorMember.brandAccess.length > 0) {
      if (!actorMember.brandAccess.includes(sceneData.brandId)) {
        return NextResponse.json(
          { error: "You do not have access to this brand" },
          { status: 403 },
        );
      }
    }

    // Create scene document
    const sceneRef = adminDb.collection("scenes").doc();
    await sceneRef.set({
      ...sceneData,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ sceneId: sceneRef.id }, { status: 201 });
  } catch (error) {
    console.error("Error creating scene:", error);
    return NextResponse.json(
      { error: "Failed to create scene" },
      { status: 500 },
    );
  }
}
