import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * GET /api/audience/child-events?parentEventId=xxx
 *
 * Returns active child events for an event group. Used by the audience join
 * flow to display event selection when the parent is a "group" type event.
 *
 * This route uses the Admin SDK (bypasses Firestore security rules) so that
 * the `events` collection does not need a public `list` rule.
 *
 * Query parameters:
 * - parentEventId: string (required) — the parent event group ID
 *
 * Response:
 * - 200: { events: Array<{ id, name, scheduledDate, status, ... }> }
 * - 400: Missing parentEventId
 * - 500: Server error
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const parentEventId = searchParams.get("parentEventId");

    if (!parentEventId) {
      return NextResponse.json(
        { error: "Missing required query parameter: parentEventId" },
        { status: 400 },
      );
    }

    // Query child events via Admin SDK — bypasses security rules
    const childEventsSnap = await adminDb
      .collection("events")
      .where("parentEventId", "==", parentEventId)
      .where("eventType", "==", "event")
      .where("isActive", "==", true)
      .orderBy("scheduledDate", "asc")
      .get();

    const events = childEventsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        description: data.description ?? null,
        venue: data.venue ?? null,
        status: data.status,
        eventType: data.eventType,
        scheduledDate: data.scheduledDate?.toDate?.()?.toISOString() ?? null,
        scheduledStartTime: data.scheduledStartTime ?? null,
        isActive: data.isActive,
      };
    });

    return NextResponse.json({ events }, { status: 200 });
  } catch (error) {
    console.error("Error fetching child events:", error);
    return NextResponse.json(
      { error: "Failed to fetch child events" },
      { status: 500 },
    );
  }
}
