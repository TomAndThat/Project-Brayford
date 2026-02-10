/**
 * PATCH /api/brands/[brandId]
 * DELETE /api/brands/[brandId]
 *
 * Server-side endpoints for updating and soft-deleting brands.
 *
 * PATCH: Requires brands:update permission. Updates brand fields.
 * DELETE: Requires brands:delete permission. Soft-deletes (sets isActive = false).
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
  BRANDS_UPDATE,
  BRANDS_DELETE,
  validateUpdateBrandData,
} from "@brayford/core";
import type { OrganizationMember, Permission } from "@brayford/core";

/**
 * Helper: fetch brand and verify caller has the required permission
 */
async function verifyBrandPermission(
  request: NextRequest,
  brandId: string,
  requiredPermission: Permission,
): Promise<
  | { error: NextResponse }
  | { error: null; brandRef: FirebaseFirestore.DocumentReference }
> {
  const auth = await authenticateRequest(request);
  if (auth.error) return { error: auth.error };
  const { uid } = auth;

  const brandRef = adminDb.collection("brands").doc(brandId);
  const brandDoc = await brandRef.get();

  if (!brandDoc.exists) {
    return {
      error: NextResponse.json(
        { error: "Brand not found" },
        { status: 404 },
      ),
    };
  }

  const brandData = brandDoc.data()!;
  const organizationId = brandData.organizationId;

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

  return { error: null, brandRef };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> },
): Promise<NextResponse> {
  try {
    const { brandId } = await params;

    const result = await verifyBrandPermission(request, brandId, BRANDS_UPDATE);
    if (result.error) return result.error;

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

    let validatedData;
    try {
      validatedData = validateUpdateBrandData(body);
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid update data", details: String(error) },
        { status: 400 },
      );
    }

    await result.brandRef.update(validatedData);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Brand update failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> },
): Promise<NextResponse> {
  try {
    const { brandId } = await params;

    const result = await verifyBrandPermission(request, brandId, BRANDS_DELETE);
    if (result.error) return result.error;

    // Soft-delete: set isActive = false
    await result.brandRef.update({ isActive: false });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Brand deletion failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
