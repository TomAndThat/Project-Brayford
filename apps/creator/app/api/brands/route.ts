/**
 * POST /api/brands
 *
 * Server-side endpoint for creating a brand within an organisation.
 * Requires brands:create permission.
 *
 * Also handles auto-granting the new brand to members who have
 * autoGrantNewBrands enabled (previously done client-side).
 *
 * Request body: { organizationId: string, name: string, logo?: string, description?: string }
 * Authorization: Bearer <Firebase ID Token>
 *
 * Response:
 * 201: { brandId: string }
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
  BRANDS_CREATE,
  validateCreateBrandData,
} from "@brayford/core";
import type { OrganizationMember } from "@brayford/core";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Authenticate
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    const { uid } = auth;

    // 2. Parse and validate body
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
      validatedData = validateCreateBrandData(body);
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid brand data", details: String(error) },
        { status: 400 },
      );
    }

    const { organizationId } = validatedData;

    // 3. Verify caller has brands:create permission
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
      brandAccess: memberData.brandAccess || [],
    } as OrganizationMember;

    if (!hasPermission(actorMember, BRANDS_CREATE)) {
      return NextResponse.json(
        { error: "You do not have permission to create brands" },
        { status: 403 },
      );
    }

    // 4. Create the brand
    const brandRef = adminDb.collection("brands").doc();

    // Strip undefined values
    const cleanData = Object.fromEntries(
      Object.entries(validatedData).filter(([, v]) => v !== undefined),
    );

    await brandRef.set({
      ...cleanData,
      createdAt: FieldValue.serverTimestamp(),
      isActive: true,
    });

    // 5. Auto-grant brand to members who have autoGrantNewBrands enabled
    try {
      const autoGrantQuery = await adminDb
        .collection("organizationMembers")
        .where("organizationId", "==", organizationId)
        .where("autoGrantNewBrands", "==", true)
        .get();

      const updates = autoGrantQuery.docs.map((memberDoc) =>
        memberDoc.ref.update({
          brandAccess: FieldValue.arrayUnion(brandRef.id),
        }),
      );

      await Promise.all(updates);
    } catch (error) {
      // Log but don't fail brand creation if auto-grant fails
      console.error("Auto-grant brand to members failed:", error);
    }

    return NextResponse.json({ brandId: brandRef.id }, { status: 201 });
  } catch (error) {
    console.error("Brand creation failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
