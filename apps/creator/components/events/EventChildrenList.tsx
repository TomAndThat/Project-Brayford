"use client";

import { useRouter } from "next/navigation";
import { fromBranded } from "@brayford/core";
import type { EventDocument } from "@brayford/core";

interface EventChildrenListProps {
  childEvents: EventDocument[];
}

export default function EventChildrenList({
  childEvents,
}: EventChildrenListProps) {
  const router = useRouter();

  if (childEvents.length === 0) return null;

  return (
    <div className="mt-8 bg-white rounded-lg shadow-md p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Child Events</h2>
      <p className="text-sm text-gray-600 mb-6">
        This event group contains {childEvents.length} child event
        {childEvents.length !== 1 ? "s" : ""}.
      </p>
      <div className="space-y-4">
        {childEvents.map((child) => (
          <div
            key={fromBranded(child.id)}
            className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
            onClick={() =>
              router.push(`/dashboard/events/${fromBranded(child.id)}`)
            }
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded bg-indigo-100 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-indigo-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900">
                    {child.name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {child.scheduledDate.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {" at "}
                    {child.scheduledStartTime}
                    {child.venue && ` • ${child.venue}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    child.status === "draft"
                      ? "bg-gray-100 text-gray-800"
                      : child.status === "active"
                        ? "bg-green-100 text-green-800"
                        : child.status === "live"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-red-100 text-red-800"
                  }`}
                >
                  {child.status.charAt(0).toUpperCase() + child.status.slice(1)}
                </span>
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
