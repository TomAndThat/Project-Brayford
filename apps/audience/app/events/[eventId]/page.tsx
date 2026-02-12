"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  toBranded,
  type EventId,
  type EventDocument,
  type BrandDocument,
  type BrandId,
  DEFAULT_AUDIENCE_BACKGROUND,
  DEFAULT_AUDIENCE_TEXT,
} from "@brayford/core";
import { getEvent, getBrand } from "@brayford/firebase-utils";

export default function EventPage() {
  const params = useParams<{ eventId: string }>();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<EventDocument | null>(null);
  const [brand, setBrand] = useState<BrandDocument | null>(null);
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

        // Fetch brand data for styling
        const brandData = await getBrand(eventData.brandId);
        if (brandData) {
          setBrand(brandData);
        }
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
  const backgroundColor =
    brand?.styling?.backgroundColor || DEFAULT_AUDIENCE_BACKGROUND;
  const textColor = brand?.styling?.textColor || DEFAULT_AUDIENCE_TEXT;

  return (
    // Background div
    <div
      className="min-h-screen w-full"
      style={{ backgroundColor, color: textColor }}
    >
      {/* Container */}
      <div className="w-full max-w-[500px] mx-auto">
        {/* Header 1 - profile img against background */}
        {/* NOTE: User can set background color OR background img (or both?) */}
        <div className="w-full px-30 py-15 bg-red-500 bg-cover bg-center bg-no-repeat">
          {/* Profile img */}
          <div className="w-full">
            <img className="rounded" src={"https://placehold.co/400x400"} />
          </div>
        </div>

        {/* Header 2 - full size image */}
        {/* NOTE: Users can *still* set bg color/image, because they may wish to use a in image with transparency for the profile image */}
        <div className="w-full bg-red-500 bg-cover bg-center bg-no-repeat">
          <img className="w-full h-auto" src={"https://placehold.co/600x400"} />
        </div>
      </div>
    </div>
  );
}
