"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  getEvent,
  getUserOrganizations,
  useEventDocument,
} from "@brayford/firebase-utils";
import {
  toBranded,
  type UserId,
  type EventId,
  hasBrandAccess,
} from "@brayford/core";
import StudioTopBar from "@/components/studio/StudioTopBar";
import StudioNavRail, {
  type StudioView,
} from "@/components/studio/StudioNavRail";
import SceneControlView from "@/components/studio/SceneControlView";
import EventControlView from "@/components/studio/EventControlView";
import MessageModerationView from "@/components/studio/messages/MessageModerationView";
import SandboxBanner from "@/components/studio/SandboxBanner";
import SandboxJoinPanel from "@/components/studio/SandboxJoinPanel";

export default function StudioPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [accessLoading, setAccessLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [currentView, setCurrentView] = useState<StudioView>("event-control");
  const [resetLoading, setResetLoading] = useState(false);

  const eventIdBranded = toBranded<EventId>(eventId);
  const { event, loading: eventLoading } = useEventDocument(eventIdBranded);

  useEffect(() => {
    async function checkAccess() {
      if (authLoading) return;

      if (!user) {
        router.push("/signin");
        return;
      }

      try {
        const eventData = await getEvent(eventIdBranded);

        if (!eventData) {
          router.push("/dashboard");
          return;
        }

        // Check if user has access to this event's brand
        const userId = toBranded<UserId>(user.uid);
        const userMemberships = await getUserOrganizations(userId);

        // Find membership for the event's organization
        const membership = userMemberships.find(
          (m) => m.organizationId === eventData.organizationId,
        );

        if (!membership) {
          router.push("/dashboard");
          return;
        }

        // Sandbox events are accessible to all org members regardless of brand
        // assignment — the system brand is hidden, so the normal brand ACL would
        // otherwise silently block anyone without BRANDS_CREATE (i.e. Members).
        if (!eventData.isSandbox) {
          const hasEventAccess = hasBrandAccess(membership, eventData.brandId);

          if (!hasEventAccess) {
            router.push("/dashboard");
            return;
          }
        }

        setHasAccess(true);
      } catch (error) {
        console.error("Error loading studio:", error);
        router.push("/dashboard");
      } finally {
        setAccessLoading(false);
      }
    }

    checkAccess();
  }, [user, authLoading, router, eventId]);

  if (authLoading || accessLoading || eventLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-lg text-white">Loading studio...</div>
      </div>
    );
  }

  if (!hasAccess || !event) {
    return null; // Will redirect via useEffect
  }

  const handleSandboxReset = async () => {
    if (!event?.isSandbox) return;
    setResetLoading(true);
    try {
      const idToken = await user?.getIdToken();
      if (!idToken) return;
      await fetch("/api/sandbox/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          organizationId: event.organizationId.toString(),
        }),
      });
    } catch (error) {
      console.error("Sandbox reset failed:", error);
    } finally {
      setResetLoading(false);
    }
  };

  const renderView = () => {
    switch (currentView) {
      case "event-control":
        return <EventControlView event={event} />;
      case "scenes":
        return <SceneControlView event={event} />;
      case "messages":
        return <MessageModerationView event={event} />;
      case "sandbox-join":
        return <SandboxJoinPanel event={event} />;
      case "polls":
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">
                Poll Management
              </h2>
              <p className="text-gray-400">View content will go here</p>
            </div>
          </div>
        );
      case "settings":
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Settings</h2>
              <p className="text-gray-400">View content will go here</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Sandbox banner — only visible for sandbox/test events */}
      {event.isSandbox && (
        <SandboxBanner
          onReset={handleSandboxReset}
          resetLoading={resetLoading}
        />
      )}

      {/* Top Context Bar */}
      <StudioTopBar event={event} />

      {/* Main Layout: Nav Rail + Canvas */}
      <div className="flex flex-1 overflow-hidden">
        <StudioNavRail
          currentView={currentView}
          onViewChange={setCurrentView}
          eventStatus={event.status}
          isSandbox={event.isSandbox ?? false}
        />

        {/* Main Canvas */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {renderView()}
        </main>
      </div>
    </div>
  );
}
