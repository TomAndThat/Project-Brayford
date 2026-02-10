/**
 * Shared API Route Authentication Utility
 *
 * Extracts and verifies Firebase ID tokens from API route requests.
 * Used by all authenticated server-side API routes.
 *
 * @example
 * ```ts
 * export async function POST(request: NextRequest) {
 *   const auth = await authenticateRequest(request);
 *   if (auth.error) return auth.error;
 *   const { uid, email } = auth;
 *   // ... use uid/email
 * }
 * ```
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import type { DecodedIdToken } from "firebase-admin/auth";

interface AuthSuccess {
  error: null;
  uid: string;
  email: string;
  token: DecodedIdToken;
}

interface AuthFailure {
  error: NextResponse;
  uid?: undefined;
  email?: undefined;
  token?: undefined;
}

export type AuthResult = AuthSuccess | AuthFailure;

/**
 * Authenticate an API route request using Firebase ID token.
 *
 * Extracts the Bearer token from the Authorization header,
 * verifies it with Firebase Admin Auth, and returns the decoded token.
 *
 * @param request - The incoming Next.js request
 * @returns AuthResult with uid/email on success, or error NextResponse on failure
 */
export async function authenticateRequest(
  request: NextRequest,
): Promise<AuthResult> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      error: NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 },
      ),
    };
  }

  const idToken = authHeader.slice(7);
  let decodedToken: DecodedIdToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch {
    return {
      error: NextResponse.json(
        { error: "Invalid or expired authentication token" },
        { status: 401 },
      ),
    };
  }

  const email = decodedToken.email;
  if (!email) {
    return {
      error: NextResponse.json(
        { error: "User account has no email address" },
        { status: 400 },
      ),
    };
  }

  return {
    error: null,
    uid: decodedToken.uid,
    email,
    token: decodedToken,
  };
}
