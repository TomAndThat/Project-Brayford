/**
 * GET   /api/scenes/[sceneId]
 * PATCH /api/scenes/[sceneId]
 *
 * Get or update a single scene.
 * Requires events:manage_modules permission.
 *
 * GET Response:
 * 200: { scene: SceneDocument }
 *
 * PATCH Request body: {
 *   name?: string,
 *   description?: string,
 *   modules?: ModuleInstance[]
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
import { FieldValue } from "firebase-admin/firestore";
import { authenticateRequest } from "@/lib/api-auth";
import {
  hasPermission,
  EVENTS_MANAGE_MODULES,
  validateUpdateSceneData,
} from "@brayford/core";
import type { OrganizationMember } from "@brayford/core";

type RouteParams = {
  params: Promise<{ sceneId: string }>;
};

/**
 * GET /api/scenes/[sceneId]
 *
 * Retrieve a single scene.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const { sceneId } = await params;

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

    // Get scene
    const sceneRef = adminDb.collection("scenes").doc(sceneId);
    const sceneSnap = await sceneRef.get();

    if (!sceneSnap.exists) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    const sceneData = sceneSnap.data()!;

    // Verify scene belongs to user's organization
    if (sceneData.organizationId !== actorMember.organizationId) {
      return NextResponse.json(
        { error: "You do not have access to this scene" },
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

    const scene = {
      id: sceneSnap.id,
      ...sceneData,
      createdAt: sceneData.createdAt?.toDate?.()?.toISOString() || sceneData.createdAt,
      updatedAt: sceneData.updatedAt?.toDate?.()?.toISOString() || sceneData.updatedAt,
    };

    return NextResponse.json({ scene }, { status: 200 });
  } catch (error) {
    console.error("Error fetching scene:", error);
    return NextResponse.json(
      { error: "Failed to fetch scene" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/scenes/[sceneId]
 *
 * Update a scene's properties.
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const { sceneId } = await params;

    // Authenticate
    const authResult = await authenticateRequest(request);
    if (authResult.error) {
      return authResult.error;
    }
    const { uid } = authResult;

    // Parse request body
    const body = await request.json();
    let updateData;
    try {
      updateData = validateUpdateSceneData(body);
    } catch (validationError) {
      console.error("Scene update validation error:", validationError);
      return NextResponse.json(
        { error: "Invalid scene data" },
        { status: 400 },
      );
    }

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

    // Get scene
    const sceneRef = adminDb.collection("scenes").doc(sceneId);
    const sceneSnap = await sceneRef.get();

    if (!sceneSnap.exists) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    const sceneData = sceneSnap.data()!;

    // Verify scene belongs to user's organization
    if (sceneData.organizationId !== actorMember.organizationId) {
      return NextResponse.json(
        { error: "You do not have access to this scene" },
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

    // Update scene
    await sceneRef.update({
      ...updateData,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error updating scene:", error);
    return NextResponse.json(
      { error: "Failed to update scene" },
      { status: 500 },
    );
  }
}
