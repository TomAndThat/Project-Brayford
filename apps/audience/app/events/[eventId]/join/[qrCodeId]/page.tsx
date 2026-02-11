"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  toBranded,
  fromBranded,
  type EventId,
  type QRCodeId,
  type EventDocument,
  type QRCodeDocument,
} from "@brayford/core";
import { getEvent, getQRCode, getChildEvents } from "@brayford/firebase-utils";
import { getOrCreateUUID } from "@/lib/uuid";

export default function JoinEventPage() {
  const params = useParams<{ eventId: string; qrCodeId: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<EventDocument | null>(null);
  const [qrCode, setQRCode] = useState<QRCodeDocument | null>(null);
  const [childEvents, setChildEvents] = useState<EventDocument[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadEventAndQRCode = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load event
        const eventData = await getEvent(toBranded<EventId>(params.eventId));
        if (!eventData) {
          setError("Event not found");
          return;
        }

        setEvent(eventData);

        // Load QR code and verify it's valid
        const qrCodeData = await getQRCode(
          toBranded<QRCodeId>(params.qrCodeId),
        );

        if (!qrCodeData) {
          setError("QR code not found");
          return;
        }

        if (!qrCodeData.isActive) {
          setError("This QR code is no longer active");
          return;
        }

        // Verify QR code belongs to this event
        if (qrCodeData.eventId !== eventData.id) {
          setError("Invalid QR code for this event");
          return;
        }

        setQRCode(qrCodeData);

        // If this is an event group, load child events
        if (eventData.eventType === "group") {
          const children = await getChildEvents(eventData.id, true);
          setChildEvents(children);
        } else {
          // Regular event - handle entry
          await handleEventEntry(eventData);
        }
      } catch (err) {
        console.error("Error loading event:", err);
        setError("Failed to load event. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadEventAndQRCode();
  }, [params.eventId, params.qrCodeId]);

  const handleEventEntry = async (eventData: EventDocument) => {
    try {
      // Get or generate UUID from localStorage
      const audienceUUID = getOrCreateUUID();

      // Create session via API (which sets httpOnly cookie)
      const response = await fetch("/api/audience/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId: params.eventId,
          qrCodeId: params.qrCodeId,
          audienceUUID,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to join event");
      }

      // Redirect to event page
      router.push(`/events/${params.eventId}`);
    } catch (err) {
      console.error("Error entering event:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to join event. Please try again.",
      );
      setLoading(false);
    }
  };

  const handleSelectChildEvent = (childEventId: string) => {
    // Redirect to child event (which will handle entry)
    router.push(`/events/${childEventId}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-600 mx-auto"></div>
          <p className="text-lg text-zinc-600">Loading event...</p>
        </div>
      </div>
    );
  }

  if (error || !event || !qrCode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
        <div className="max-w-md text-center">
          <div className="mb-4 mx-auto h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
            <svg
              className="h-8 w-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="mb-2 text-2xl font-semibold text-zinc-900">
            Unable to Access Event
          </h1>
          <p className="text-lg text-zinc-600">
            {error || "Something went wrong"}
          </p>
        </div>
      </div>
    );
  }

  // Event group - show child events list
  if (event.eventType === "group") {
    return (
      <div className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-2xl px-4 py-12">
          <div className="mb-8 text-center">
            <div className="mb-4 mx-auto h-16 w-16 rounded-full bg-purple-100 flex items-center justify-center">
              <svg
                className="h-8 w-8 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
            </div>
            <h1 className="mb-2 text-3xl font-bold text-zinc-900">
              {event.name}
            </h1>
            <p className="text-lg text-zinc-600">Select an event to join</p>
          </div>

          {childEvents.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-zinc-300 bg-white p-12 text-center">
              <p className="text-zinc-600">
                No events available in this group yet. Check back soon!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {childEvents.map((childEvent) => (
                <button
                  key={fromBranded(childEvent.id)}
                  onClick={() =>
                    handleSelectChildEvent(fromBranded(childEvent.id))
                  }
                  className="w-full rounded-lg border border-zinc-200 bg-white p-6 text-left transition-all hover:border-blue-500 hover:shadow-md"
                >
                  <h3 className="mb-2 text-xl font-semibold text-zinc-900">
                    {childEvent.name}
                  </h3>
                  {childEvent.venue && (
                    <p className="mb-2 text-sm text-zinc-600">
                      📍 {childEvent.venue}
                    </p>
                  )}
                  <p className="text-sm text-zinc-500">
                    {childEvent.scheduledDate.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}{" "}
                    at {childEvent.scheduledStartTime}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Regular event - loading while we process entry
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="text-center">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-600 mx-auto"></div>
        <p className="text-lg text-zinc-600">Joining {event.name}...</p>
      </div>
    </div>
  );
}
