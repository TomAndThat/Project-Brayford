"use client";

import { useRouter } from "next/navigation";
import {
  fromBranded,
  type EventDocument,
  type BrandDocument,
} from "@brayford/core";
import {
  getBrandName,
  formatEventDate,
  getStatusColor,
  isEventGroup,
  getChildEventCount,
} from "@/hooks/use-events-page-data";

interface EventsTableProps {
  /** Filtered events to display. */
  filteredEvents: EventDocument[];
  /** All events (needed for child-count calculations). */
  allEvents: EventDocument[];
  /** Brands for resolving brand names. */
  brands: BrandDocument[];
  /** Whether the user can create events. */
  canCreate: boolean;
  /** Current filter label for empty-state messaging. */
  filterLabel: string;
  /** Callback to open the create-event modal. */
  onCreateEvent: () => void;
}

export default function EventsTable({
  filteredEvents,
  allEvents,
  brands,
  canCreate,
  filterLabel,
  onCreateEvent,
}: EventsTableProps) {
  const router = useRouter();

  // ── No events at all ────────────────────────────────────────────────
  if (filteredEvents.length === 0 && allEvents.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            No events yet
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            Create your first event to start managing live shows.
          </p>
          {canCreate && (
            <button
              onClick={onCreateEvent}
              className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Create Your First Event
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Filter returned no results ──────────────────────────────────────
  if (filteredEvents.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            No {filterLabel} events
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            {filterLabel === "active"
              ? "All events are currently archived."
              : "No archived events found."}
          </p>
        </div>
      </div>
    );
  }

  // ── Events table ────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Event
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Brand
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date &amp; Time
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Venue
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {filteredEvents.map((event) => (
            <tr
              key={fromBranded(event.id)}
              className={`hover:bg-gray-50 cursor-pointer ${
                !event.isActive ? "opacity-60" : ""
              }`}
              onClick={() =>
                router.push(`/dashboard/events/${fromBranded(event.id)}`)
              }
            >
              {/* Event Info */}
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div
                    className={`w-10 h-10 rounded flex items-center justify-center ${
                      isEventGroup(event)
                        ? "bg-purple-100"
                        : event.parentEventId
                          ? "bg-indigo-100"
                          : "bg-blue-100"
                    }`}
                  >
                    <svg
                      className={`w-5 h-5 ${
                        isEventGroup(event)
                          ? "text-purple-600"
                          : event.parentEventId
                            ? "text-indigo-600"
                            : "text-blue-600"
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      {isEventGroup(event) ? (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                        />
                      ) : event.parentEventId ? (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      ) : (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      )}
                    </svg>
                  </div>
                  <div className="ml-4">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-gray-900">
                        {event.name}
                      </div>
                      {isEventGroup(event) && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                          Group (
                          {getChildEventCount(allEvents, fromBranded(event.id))}
                          )
                        </span>
                      )}
                      {event.parentEventId && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                          Child Event
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </td>

              {/* Brand */}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {getBrandName(brands, fromBranded(event.brandId))}
              </td>

              {/* Date & Time */}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <div>{formatEventDate(event.scheduledDate)}</div>
                <div className="text-xs text-gray-400">
                  {event.scheduledStartTime}
                </div>
              </td>

              {/* Venue */}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {event.venue || "-"}
              </td>

              {/* Status */}
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                    event.status,
                  )}`}
                >
                  {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
