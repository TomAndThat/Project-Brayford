/**
 * PATCH /api/organizations/[organizationId]
 *
 * Server-side endpoint for updating organisation settings.
 * Requires org:update permission.
 *
 * Request body: Partial organisation data (validated by Zod)
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
  ORG_UPDATE,
  validateUpdateOrganizationData,
} from "@brayford/core";
import type { OrganizationMember } from "@brayford/core";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> },
): Promise<NextResponse> {
  try {
    // 1. Authenticate
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    const { uid } = auth;

    const { organizationId } = await params;

    // 2. Verify organisation exists
    const orgRef = adminDb.collection("organizations").doc(organizationId);
    const orgDoc = await orgRef.get();

    if (!orgDoc.exists) {
      return NextResponse.json(
        { error: "Organisation not found" },
        { status: 404 },
      );
    }

    // 3. Verify caller has org:update permission
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

    if (!hasPermission(actorMember, ORG_UPDATE)) {
      return NextResponse.json(
        { error: "You do not have permission to update this organisation" },
        { status: 403 },
      );
    }

    // 4. Parse and validate request body
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
      validatedData = validateUpdateOrganizationData(body);
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid update data", details: String(error) },
        { status: 400 },
      );
    }

    // 5. Update
    await orgRef.update(validatedData);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Organisation update failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
