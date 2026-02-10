/**
 * POST /api/invitations/create
 *
 * Server-side endpoint for creating organisation invitations.
 * Replaces the client-side createInvitation() call.
 *
 * This must be server-side because:
 * 1. Validates inviter has users:invite permission
 * 2. Validates role-specific constraints (only wildcard holders can invite owners)
 * 3. Prevents unauthorized users from creating invitations
 * 4. Generates secure tokens server-side
 *
 * Request body:
 * {
 *   email: string,
 *   organizationId: string,
 *   organizationName: string,
 *   role: 'owner' | 'admin' | 'member',
 *   brandAccess: string[],
 *   autoGrantNewBrands: boolean,
 *   metadata?: { inviterName?: string, inviterEmail?: string },
 * }
 *
 * Authorization: Bearer <Firebase ID Token>
 *
 * Response:
 * 201: { invitationId: string }
 * 400: { error: string }
 * 401: { error: string }
 * 403: { error: string }
 * 409: { error: string }
 * 500: { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { authenticateRequest } from "@/lib/api-auth";
import {
  hasPermission,
  canInviteRole,
  generateInvitationToken,
  calculateInvitationExpiry,
  getPermissionsForRole,
  USERS_INVITE,
} from "@brayford/core";
import type {
  OrganizationRole,
  InvitationRole,
  OrganizationMember,
} from "@brayford/core";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Authenticate
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    const { uid } = auth;

    // 2. Parse request body
    let body: {
      email?: string;
      organizationId?: string;
      organizationName?: string;
      role?: string;
      brandAccess?: string[];
      autoGrantNewBrands?: boolean;
      metadata?: { inviterName?: string; inviterEmail?: string };
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    const {
      email,
      organizationId,
      organizationName,
      role,
      brandAccess = [],
      autoGrantNewBrands = false,
      metadata,
    } = body;

    if (!email || !organizationId || !organizationName || !role) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: email, organizationId, organizationName, role",
        },
        { status: 400 },
      );
    }

    if (!["owner", "admin", "member"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be owner, admin, or member" },
        { status: 400 },
      );
    }

    // 3. Verify caller is a member of the organisation with invite permission
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

    // Check invite permission
    if (!hasPermission(actorMember, USERS_INVITE)) {
      return NextResponse.json(
        { error: "You do not have permission to invite users" },
        { status: 403 },
      );
    }

    // Check role-specific constraints
    if (!canInviteRole(actorMember, role as InvitationRole)) {
      return NextResponse.json(
        { error: `You do not have permission to invite users as ${role}` },
        { status: 403 },
      );
    }

    // 4. Check for existing pending invitation
    const normalizedEmail = email.toLowerCase().trim();
    const existingQuery = await adminDb
      .collection("invitations")
      .where("email", "==", normalizedEmail)
      .where("organizationId", "==", organizationId)
      .where("status", "==", "pending")
      .limit(1)
      .get();

    if (!existingQuery.empty) {
      return NextResponse.json(
        {
          error: "A pending invitation already exists for this email",
          existingInvitationId: existingQuery.docs[0]!.id,
        },
        { status: 409 },
      );
    }

    // 5. Check if user is already a member
    const existingMemberQuery = await adminDb
      .collection("organizationMembers")
      .where("organizationId", "==", organizationId)
      .get();

    // We need to cross-reference with user emails — check the users collection
    // for any member whose email matches
    for (const memberDoc of existingMemberQuery.docs) {
      const mData = memberDoc.data();
      const userDoc = await adminDb
        .collection("users")
        .doc(mData.userId)
        .get();
      if (
        userDoc.exists &&
        userDoc.data()?.email?.toLowerCase() === normalizedEmail
      ) {
        return NextResponse.json(
          {
            error:
              "A user with this email is already a member of this organisation",
          },
          { status: 409 },
        );
      }
    }

    // 6. Create invitation
    const invRef = adminDb.collection("invitations").doc();
    const token = generateInvitationToken();
    const expiresAt = calculateInvitationExpiry();

    await invRef.set({
      email: normalizedEmail,
      organizationId,
      organizationName,
      role,
      brandAccess,
      autoGrantNewBrands,
      invitedBy: uid,
      invitedAt: FieldValue.serverTimestamp(),
      status: "pending",
      token,
      expiresAt,
      acceptedAt: null,
      ...(metadata ? { metadata } : {}),
    });

    return NextResponse.json({ invitationId: invRef.id }, { status: 201 });
  } catch (error) {
    console.error("Invitation creation failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
