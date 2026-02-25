"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  toBranded,
  fromBranded,
  type EventId,
  type QRCodeId,
  type EventDocument,
  type QRCodeDocument,
} from "@brayford/core";
import {
  getEvent,
  getQRCode,
  useEventDocument,
  withJitter,
} from "@brayford/firebase-utils";
import { getOrCreateUUID } from "@/lib/uuid";
import FullScreenLoader from "@/components/FullScreenLoader";
import FullScreenMessage from "@/components/FullScreenMessage";

/** Lightweight shape returned by the child-events API route. */
interface ChildEventSummary {
  id: string;
  name: string;
  venue: string | null;
  scheduledDate: string | null;
  scheduledStartTime: string | null;
  status: string;
}

/**
 * Fetch active child events for an event group via the server-side API route.
 * Uses the Admin SDK on the server, avoiding the need for a public Firestore
 * `list` rule on the events collection.
 */
async function fetchChildEvents(
  parentEventId: string,
): Promise<ChildEventSummary[]> {
  const response = await fetch(
    `/api/audience/child-events?parentEventId=${encodeURIComponent(parentEventId)}`,
  );
  if (!response.ok) {
    throw new Error("Failed to fetch child events");
  }
  const data = await response.json();
  return data.events as ChildEventSummary[];
}

type JoinErrorType =
  | "not-found"
  | "not-started"
  | "ended"
  | "qr-inactive"
  | "failed";

export default function JoinEventPage() {
  const params = useParams<{ eventId: string; qrCodeId: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [joiningMessage, setJoiningMessage] = useState<string | null>(null);
  const [event, setEvent] = useState<EventDocument | null>(null);
  const [qrCode, setQRCode] = useState<QRCodeDocument | null>(null);
  const [childEvents, setChildEvents] = useState<ChildEventSummary[]>([]);
  const [errorType, setErrorType] = useState<JoinErrorType | null>(null);

  // Real-time event subscription — used to detect when the host takes the
  // event live so we can automatically resume the join flow for waiting audience
  // members without them needing to refresh.
  const { event: liveEvent } = useEventDocument(
    toBranded<EventId>(params.eventId),
  );

  // Guard against the auto-join callback firing more than once.
  const autoJoinFired = useRef(false);

  // Initial gate check — one-off fetch to determine whether to proceed or wait.
  useEffect(() => {
    const loadEventAndQRCode = async () => {
      try {
        setLoading(true);
        setErrorType(null);

        const eventData = await getEvent(toBranded<EventId>(params.eventId));
        if (!eventData) {
          setErrorType("not-found");
          return;
        }

        setEvent(eventData);

        // Gate access: QR codes are only scannable for live events
        if (eventData.status === "ended") {
          setErrorType("ended");
          return;
        }

        if (eventData.status !== "live") {
          // Show the waiting screen — the real-time subscription below will
          // detect when the event goes live and resume automatically.
          setErrorType("not-started");
          return;
        }

        const qrCodeData = await getQRCode(
          toBranded<QRCodeId>(params.qrCodeId),
        );

        if (!qrCodeData) {
          setErrorType("not-found");
          return;
        }

        if (!qrCodeData.isActive) {
          setErrorType("qr-inactive");
          return;
        }

        if (qrCodeData.eventId !== eventData.id) {
          setErrorType("not-found");
          return;
        }

        setQRCode(qrCodeData);

        if (eventData.eventType === "group") {
          const children = await fetchChildEvents(fromBranded(eventData.id));
          setChildEvents(children);
        } else {
          await handleEventEntry(eventData);
        }
      } catch (err) {
        console.error("Error loading event:", err);
        setErrorType("failed");
      } finally {
        setLoading(false);
      }
    };

    loadEventAndQRCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.eventId, params.qrCodeId]);

  // Auto-join: when the host takes the event live while an audience member is
  // sitting on the "Not Started Yet" waiting screen, automatically resume the
  // join flow so they're taken in without any interaction.
  useEffect(() => {
    if (errorType !== "not-started") return;
    if (!liveEvent || liveEvent.status !== "live") return;
    if (autoJoinFired.current) return;

    autoJoinFired.current = true;

    const resumeJoin = async () => {
      try {
        // Re-validate QR code — it may have been deactivated while waiting.
        const qrCodeData = await getQRCode(
          toBranded<QRCodeId>(params.qrCodeId),
        );

        if (!qrCodeData || !qrCodeData.isActive) {
          setErrorType("qr-inactive");
          return;
        }

        if (liveEvent.eventType === "group") {
          const children = await fetchChildEvents(fromBranded(liveEvent.id));
          setEvent(liveEvent);
          setQRCode(qrCodeData);
          setChildEvents(children);
          setErrorType(null);
          setLoading(false);
        } else {
          setLoading(false);
          await handleEventEntry(liveEvent);
        }
      } catch (err) {
        console.error("Error during auto-join:", err);
        setErrorType("failed");
        setLoading(false);
      }
    };

    void resumeJoin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorType, liveEvent?.status]);

  const handleEventEntry = async (eventData: EventDocument) => {
    setJoiningMessage(`Joining ${eventData.name}…`);
    try {
      const audienceUUID = getOrCreateUUID();

      const response = await withJitter(
        () =>
          fetch("/api/audience/join", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              eventId: params.eventId,
              qrCodeId: params.qrCodeId,
              audienceUUID,
            }),
          }),
        { windowMs: 2000 },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to join event");
      }

      router.push(`/events/${params.eventId}`);
    } catch (err) {
      console.error("Error entering event:", err);
      setErrorType("failed");
      setJoiningMessage(null);
      setLoading(false);
    }
  };

  const handleSelectChildEvent = (childEventId: string) => {
    router.push(`/events/${childEventId}`);
  };

  if (loading || joiningMessage) {
    return <FullScreenLoader message={joiningMessage ?? "Loading event…"} />;
  }

  if (errorType === "not-started" && event) {
    const formattedDate = event.scheduledDate.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return (
      <FullScreenMessage
        iconBgClass="bg-amber-100"
        iconColorClass="text-amber-600"
        icon={
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        }
        title="Not Started Yet"
        message="This event hasn't started yet. We'll take you straight in when it begins."
      >
        <p className="text-sm font-medium text-zinc-500">
          Scheduled for {formattedDate} at {event.scheduledStartTime}
        </p>
        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-zinc-400">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Waiting for the event to begin
        </div>
      </FullScreenMessage>
    );
  }

  if (errorType === "ended") {
    return (
      <FullScreenMessage
        iconBgClass="bg-slate-100"
        iconColorClass="text-slate-500"
        icon={
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        }
        title="This Event Has Ended"
        message="Thanks for your interest — this event has finished. Keep an eye out for future events!"
      />
    );
  }

  if (errorType === "qr-inactive") {
    return (
      <FullScreenMessage
        iconBgClass="bg-red-100"
        iconColorClass="text-red-600"
        icon={
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        }
        title="QR Code No Longer Valid"
        message="This QR code has been deactivated. Ask a member of the team for a new one."
      />
    );
  }

  if (errorType === "failed") {
    return (
      <FullScreenMessage
        iconBgClass="bg-red-100"
        iconColorClass="text-red-600"
        icon={
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        }
        title="Something Went Wrong"
        message="We weren't able to load this event. Please try again."
      />
    );
  }

  if (errorType === "not-found" || !event || !qrCode) {
    return (
      <FullScreenMessage
        iconBgClass="bg-zinc-100"
        iconColorClass="text-zinc-400"
        icon={
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        }
        title="Event Not Found"
        message="We couldn't find the event you're looking for. Make sure you've scanned the correct QR code."
      />
    );
  }

  // Event group — show child events list
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
                  key={childEvent.id}
                  onClick={() => handleSelectChildEvent(childEvent.id)}
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
                  {childEvent.scheduledDate && (
                    <p className="text-sm text-zinc-500">
                      {new Date(childEvent.scheduledDate).toLocaleDateString(
                        "en-GB",
                        {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        },
                      )}{" "}
                      {childEvent.scheduledStartTime &&
                        `at ${childEvent.scheduledStartTime}`}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Regular event — loading while we process entry
  return <FullScreenLoader message={`Joining ${event.name}…`} />;
}
