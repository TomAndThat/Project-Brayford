"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  toBranded,
  fromBranded,
  type EventId,
  type BrandDocument,
  type HeaderType,
  DEFAULT_AUDIENCE_BACKGROUND,
  DEFAULT_AUDIENCE_TEXT,
} from "@brayford/core";
import {
  getBrand,
  useEventLiveState,
  useEventDocument,
} from "@brayford/firebase-utils";
import SceneRenderer from "@/components/SceneRenderer";
import WaitingScreen from "@/components/WaitingScreen";
import FullScreenLoader from "@/components/FullScreenLoader";
import FullScreenMessage from "@/components/FullScreenMessage";

export default function EventPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = toBranded<EventId>(params.eventId);

  // Real-time event document subscription — status changes update the UI
  // automatically without a page refresh.
  const { event, loading: eventLoading } = useEventDocument(eventId);

  const [brand, setBrand] = useState<BrandDocument | null>(null);

  // Subscribe to live state for real-time scene updates
  const { liveState } = useEventLiveState(eventId);

  // Load brand styling whenever the event goes (or is already) live.
  // Runs whenever event.brandId changes (i.e. once on first live transition).
  useEffect(() => {
    if (event?.status !== "live" || brand) return;
    getBrand(event.brandId)
      .then((data) => {
        if (data) setBrand(data);
      })
      .catch((err) => console.error("Error loading brand:", err));
  }, [event?.status, event?.brandId, brand]);

  if (eventLoading) {
    return <FullScreenLoader message="Loading event…" />;
  }

  if (!event) {
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
        message="The event you're looking for doesn't exist or may have been removed."
      />
    );
  }

  // Status gating — derived directly from the live event document so
  // transitions happen automatically as the host changes the event status.
  if (event.status === "draft" || event.status === "active") {
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
        message="This event hasn't started yet. We'll take you in automatically when it does."
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

  if (event.status === "ended") {
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
        message="Thanks for joining us — this event has finished. Keep an eye out for future events!"
      />
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
  const headerType: HeaderType = brand?.styling?.headerType || "none";
  const headerBackgroundColor = brand?.styling?.headerBackgroundColor;
  const headerBackgroundImageUrl = brand?.styling?.headerBackgroundImageUrl;

  // Build header background styles (shared by profile, logo, and banner)
  const headerBgStyle: React.CSSProperties = {
    backgroundColor: headerBackgroundColor || "transparent",
    ...(headerBackgroundImageUrl
      ? {
          backgroundImage: `url(${headerBackgroundImageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }
      : {}),
  };

  const renderHeader = () => {
    switch (headerType) {
      case "profile":
        return brand?.styling?.profileImageUrl ? (
          <div
            className="w-full py-15 px-30 bg-cover bg-center bg-no-repeat border-b-1 "
            style={headerBgStyle}
          >
            <div className="w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="rounded border-2 w-full"
                style={{ borderColor: textColor + "40" }}
                src={brand.styling.profileImageUrl}
                alt={brand.name ?? "Profile"}
              />
            </div>
          </div>
        ) : null;

      case "logo":
        return brand?.styling?.logoImageUrl ? (
          <div
            className="w-full py-15 px-30 bg-cover bg-center bg-no-repeat border-b-1 "
            style={headerBgStyle}
          >
            <div className="w-full flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="max-w-full max-h-48 object-contain"
                src={brand.styling.logoImageUrl}
                alt={brand.name ?? "Logo"}
              />
            </div>
          </div>
        ) : null;

      case "banner":
        return brand?.styling?.bannerImageUrl ? (
          <div
            className="w-full bg-cover bg-center bg-no-repeat border-b-1 "
            style={headerBgStyle}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="w-full h-auto"
              src={brand.styling.bannerImageUrl}
              alt={brand.name ?? "Banner"}
            />
          </div>
        ) : null;

      case "none":
      default:
        return null;
    }
  };

  return (
    // Background div
    <div
      className="min-h-screen w-full"
      style={{ backgroundColor, color: textColor }}
    >
      {/* Container */}
      <div className="w-full max-w-[500px] mx-auto">
        {/* Brand Header */}
        {renderHeader()}

        {/* Scene Content Area */}
        <div
          className="transition-opacity duration-300"
          style={{ opacity: liveState?.activeSceneId ? 1 : 0.8 }}
        >
          {liveState?.activeSceneId ? (
            <SceneRenderer
              key="scene-renderer"
              sceneId={liveState.activeSceneId}
              eventName={event.name}
              eventId={fromBranded(event.id)}
              brandInputBackgroundColor={brand?.styling?.inputBackgroundColor}
              brandInputTextColor={brand?.styling?.inputTextColor}
              brandButtonBackgroundColor={brand?.styling?.buttonBackgroundColor}
              brandButtonTextColor={brand?.styling?.buttonTextColor}
            />
          ) : (
            <WaitingScreen eventName={event.name} />
          )}
        </div>
      </div>
    </div>
  );
}
