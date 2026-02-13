"use client";

import { useEffect, useState } from "react";
import type { EventDocument } from "@brayford/core";
import { useFirebaseConnection } from "@/hooks/use-firebase-connection";

interface StudioTopBarProps {
  event: EventDocument;
}

export default function StudioTopBar({ event }: StudioTopBarProps) {
  const [elapsedTime, setElapsedTime] = useState<string>("00:00:00");
  const [audienceCount] = useState<number>(0); // TODO: Real-time audience count
  const connectionStatus = useFirebaseConnection();

  useEffect(() => {
    // Calculate elapsed time if event is live
    if (event.status !== "live") return;

    const updateTimer = () => {
      // TODO: Calculate from actual event start time
      const now = new Date();
      const start = event.scheduledDate;
      const elapsed = Math.floor((now.getTime() - start.getTime()) / 1000);

      const hours = Math.floor(elapsed / 3600);
      const minutes = Math.floor((elapsed % 3600) / 60);
      const seconds = elapsed % 60;

      setElapsedTime(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [event]);

  const getStatusDisplay = () => {
    switch (event.status) {
      case "live":
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-red-900/20 border border-red-500 rounded-md">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-500 font-semibold text-sm">LIVE</span>
            <span className="text-red-400 text-sm">{elapsedTime}</span>
          </div>
        );
      case "active":
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-green-900/20 border border-green-500 rounded-md">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-green-500 font-semibold text-sm">READY</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-gray-700/20 border border-gray-600 rounded-md">
            <div className="w-2 h-2 bg-gray-500 rounded-full" />
            <span className="text-gray-400 font-semibold text-sm">OFFLINE</span>
          </div>
        );
    }
  };

  return (
    <div className="h-16 bg-gray-950 border-b border-gray-800 flex items-center justify-between px-6">
      {/* Left: Event Info */}
      <div className="flex items-center gap-4">
        <h1 className="text-white font-semibold text-lg">{event.name}</h1>
        {getStatusDisplay()}
      </div>

      {/* Right: Stats & Controls */}
      <div className="flex items-center gap-6">
        {/* Audience Count */}
        <div className="flex items-center gap-2 text-gray-400">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <span className="text-sm font-medium">
            {audienceCount.toLocaleString()}
            {event.maxAttendees && (
              <span className="text-gray-500">
                {" "}
                / {event.maxAttendees.toLocaleString()}
              </span>
            )}
          </span>
        </div>

        {/* Connection Status */}
        <div className="flex items-center gap-2">
          {connectionStatus.state === "connected" && (
            <>
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-green-500 text-sm">Connected</span>
            </>
          )}
          {connectionStatus.state === "reconnecting" && (
            <>
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              <span className="text-amber-500 text-sm">Reconnecting...</span>
            </>
          )}
          {connectionStatus.state === "disconnected" && (
            <>
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              <span className="text-red-500 text-sm">Disconnected</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
