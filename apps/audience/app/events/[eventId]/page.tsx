"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toBranded, type EventId, type EventDocument } from "@brayford/core";
import { getEvent } from "@brayford/firebase-utils";

export default function EventPage() {
  const params = useParams<{ eventId: string }>();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<EventDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadEvent = async () => {
      try {
        setLoading(true);
        setError(null);

        const eventData = await getEvent(toBranded<EventId>(params.eventId));
        if (!eventData) {
          setError("Event not found");
          return;
        }

        setEvent(eventData);
      } catch (err) {
        console.error("Error loading event:", err);
        setError("Failed to load event");
      } finally {
        setLoading(false);
      }
    };

    loadEvent();
  }, [params.eventId]);

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

  if (error || !event) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
        <div className="max-w-md text-center">
          <h1 className="mb-4 text-2xl font-semibold text-zinc-900">
            Event Not Found
          </h1>
          <p className="text-lg text-zinc-600">
            {error || "The event you're looking for doesn't exist."}
          </p>
        </div>
      </div>
    );
  }

  // Event group placeholder
  if (event.eventType === "group") {
    return (
      <div className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-2xl px-4 py-12">
          <div className="rounded-lg bg-white p-8 shadow-md">
            <div className="mb-6 flex items-center justify-center">
              <div className="h-16 w-16 rounded-full bg-purple-100 flex items-center justify-center">
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
            </div>
            <h1 className="mb-4 text-center text-3xl font-bold text-zinc-900">
              {event.name}
            </h1>
            <p className="mb-6 text-center text-lg text-zinc-600">
              This is an event group. Scan a QR code for an individual event to
              participate.
            </p>
            {event.venue && (
              <div className="rounded-lg bg-zinc-50 p-4 text-center">
                <p className="text-sm font-medium text-zinc-700">
                  📍 {event.venue}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Regular event placeholder
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Event Header */}
        <div className="mb-8 rounded-lg bg-white p-6 shadow-md">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="mb-2 text-3xl font-bold text-zinc-900">
                {event.name}
              </h1>
              {event.venue && (
                <p className="mb-2 text-zinc-600">📍 {event.venue}</p>
              )}
              <p className="text-sm text-zinc-500">
                {event.scheduledDate.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}{" "}
                at {event.scheduledStartTime}
              </p>
            </div>
            <div
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                event.status === "live"
                  ? "bg-green-100 text-green-800"
                  : event.status === "active"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-zinc-100 text-zinc-800"
              }`}
            >
              {event.status === "live"
                ? "🔴 Live"
                : event.status === "active"
                  ? "Active"
                  : event.status.charAt(0).toUpperCase() +
                    event.status.slice(1)}
            </div>
          </div>
        </div>

        {/* Placeholder content */}
        <div className="rounded-lg border-2 border-dashed border-zinc-300 bg-white p-12 text-center">
          <div className="mb-4 mx-auto h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
            <svg
              className="h-8 w-8 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <h2 className="mb-2 text-2xl font-semibold text-zinc-900">
            Event Interaction Coming Soon
          </h2>
          <p className="text-zinc-600">
            You've successfully joined {event.name}. Interactive features like
            Q&A, polls, and live reactions will appear here.
          </p>
        </div>
      </div>
    </div>
  );
}
