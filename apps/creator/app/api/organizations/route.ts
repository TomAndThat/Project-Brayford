/**
 * POST /api/organizations
 *
 * Server-side endpoint for creating a new organisation with atomic
 * owner membership. Replaces the client-side createOrganization() +
 * createOrganizationMember() two-step flow.
 *
 * This must be server-side because:
 * 1. Organisation + owner membership must be created atomically
 * 2. Validates that the authenticated user becomes the owner
 * 3. Prevents client from creating orphaned orgs or fake memberships
 *
 * Request body:
 * {
 *   name: string,
 *   type: 'individual' | 'team' | 'enterprise',
 *   billingEmail: string,
 * }
 *
 * Authorization: Bearer <Firebase ID Token>
 *
 * Response:
 * 201: { organizationId: string }
 * 400: { error: string }
 * 401: { error: string }
 * 500: { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { authenticateRequest } from "@/lib/api-auth";
import {
  validateCreateOrganizationData,
  type OrganizationType,
} from "@brayford/core";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Authenticate
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    const { uid } = auth;

    // 2. Parse and validate request body
    let body: { name?: string; type?: string; billingEmail?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    const { name, type, billingEmail } = body;

    if (!name || !type || !billingEmail) {
      return NextResponse.json(
        { error: "Missing required fields: name, type, billingEmail" },
        { status: 400 },
      );
    }

    // Validate with Zod schema (will throw on invalid data)
    try {
      validateCreateOrganizationData({
        name,
        type: type as OrganizationType,
        billingEmail,
        createdBy: uid,
      });
    } catch (validationError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details:
            validationError instanceof Error
              ? validationError.message
              : "Invalid data",
        },
        { status: 400 },
      );
    }

    // 3. Create organisation + owner membership atomically
    const orgRef = adminDb.collection("organizations").doc();
    const memberRef = adminDb.collection("organizationMembers").doc();

    const batch = adminDb.batch();

    batch.set(orgRef, {
      name: name.trim(),
      type,
      billingEmail: billingEmail.toLowerCase().trim(),
      createdBy: uid,
      createdAt: FieldValue.serverTimestamp(),
      deletionRequestId: null,
      softDeletedAt: null,
    });

    batch.set(memberRef, {
      organizationId: orgRef.id,
      userId: uid,
      role: "owner",
      brandAccess: [], // Empty = access to all brands
      invitedAt: null,
      invitedBy: null,
      joinedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return NextResponse.json(
      { organizationId: orgRef.id },
      { status: 201 },
    );
  } catch (error) {
    console.error("Organization creation failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
