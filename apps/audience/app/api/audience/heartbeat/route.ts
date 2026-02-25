/**
 * POST /api/audience/heartbeat
 *
 * Updates the lastSeenAt timestamp for the caller's audience session.
 * Used exclusively by sandbox (test) events to track active participants
 * so the scheduled eviction Cloud Function can remove inactive ones after
 * 15 minutes of inactivity.
 *
 * The session ID is read from the httpOnly `brayford_audience_session` cookie
 * set during the join flow — the client never has direct access to it.
 *
 * NOTE: This endpoint is intentionally restricted to sandbox events.
 * For real events, audience presence will be tracked using Firebase Realtime
 * Database's native presence/onDisconnect API (not yet implemented).
 *
 * Response:
 * 200: { ok: true }
 * 400: Session not found or not a sandbox event
 * 500: Server error
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(_request: NextRequest): Promise<NextResponse> {
  try {
    // Read session ID from httpOnly cookie (set during join flow)
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("brayford_audience_session")?.value;

    if (!sessionId) {
      return NextResponse.json(
        { error: "No active session" },
        { status: 400 },
      );
    }

    // Fetch the session
    const sessionDoc = await adminDb
      .collection("audienceSessions")
      .doc(sessionId)
      .get();

    if (!sessionDoc.exists) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 400 },
      );
    }

    const session = sessionDoc.data()!;

    // Only update heartbeat for active sessions
    if (!session.isActive) {
      return NextResponse.json(
        { error: "Session is no longer active" },
        { status: 400 },
      );
    }

    // Safety check: only process heartbeats for sandbox events
    // For real events, presence is handled separately (see NOTE above)
    const eventDoc = await adminDb
      .collection("events")
      .doc(session.eventId)
      .get();

    if (!eventDoc.exists || !eventDoc.data()?.isSandbox) {
      // Silently succeed — non-sandbox heartbeats are a no-op for now
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Update lastSeenAt
    await adminDb
      .collection("audienceSessions")
      .doc(sessionId)
      .update({ lastSeenAt: FieldValue.serverTimestamp() });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Heartbeat error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
