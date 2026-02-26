"use client";

import { useRouter } from "next/navigation";
import { fromBranded, type EventDocument } from "@brayford/core";

interface DashboardEventsListProps {
  events: EventDocument[];
}

export default function DashboardEventsList({
  events,
}: DashboardEventsListProps) {
  const router = useRouter();

  // Filter to active & live, sorted chronologically
  const activeEvents = events
    .filter((event) => event.status === "active" || event.status === "live")
    .sort((a, b) => {
      const dateCompare = a.scheduledDate.getTime() - b.scheduledDate.getTime();
      if (dateCompare !== 0) return dateCompare;
      return a.scheduledStartTime.localeCompare(b.scheduledStartTime);
    });

  return (
    <div
      data-testid="events-section"
      className="bg-white rounded-lg shadow-md p-8 mb-8"
    >
      <h3 className="text-xl font-semibold text-gray-900 mb-4">Your Events</h3>

      {activeEvents.length === 0 ? (
        <p className="text-gray-600">No active or live events.</p>
      ) : (
        <div className="space-y-2">
          {activeEvents.slice(0, 5).map((event) => (
            <button
              key={fromBranded(event.id)}
              onClick={() => router.push(`/studio/${fromBranded(event.id)}`)}
              className="w-full p-4 border border-gray-200 rounded-md hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-medium text-gray-900">{event.name}</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    {event.scheduledDate.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    at {event.scheduledStartTime}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    event.status === "active"
                      ? "bg-green-100 text-green-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                </span>
              </div>
            </button>
          ))}
          {activeEvents.length > 5 && (
            <p className="text-sm text-gray-500 text-center pt-2">
              ...and {activeEvents.length - 5} more events
            </p>
          )}
        </div>
      )}
    </div>
  );
}
