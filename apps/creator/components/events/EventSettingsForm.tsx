"use client";

import { fromBranded } from "@brayford/core";
import type { EventDocument } from "@brayford/core";
import type { EventFormValues } from "@/hooks/use-event-form";

interface EventSettingsFormProps {
  event: EventDocument;
  brandName: string;
  values: EventFormValues;
  onFieldChange: <K extends keyof EventFormValues>(
    key: K,
    value: EventFormValues[K],
  ) => void;
  eventGroups: EventDocument[];
  canUpdate: boolean;
  canDelete: boolean;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onArchive: () => void;
  onUnarchive: () => void;
}

export default function EventSettingsForm({
  event,
  brandName,
  values,
  onFieldChange,
  eventGroups,
  canUpdate,
  canDelete,
  isSubmitting,
  onSubmit,
  onArchive,
  onUnarchive,
}: EventSettingsFormProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Event Settings</h2>

      <form onSubmit={onSubmit}>
        {/* Brand (Read-only) */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Brand
          </label>
          <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-600">
            {brandName}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            The brand cannot be changed after event creation
          </p>
        </div>

        {/* Event Type (Read-only) */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Event Type
          </label>
          <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-600">
            {event.eventType === "group" ? (
              <span className="inline-flex items-center">
                <svg
                  className="w-4 h-4 mr-2 text-purple-600"
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
                Event Group
              </span>
            ) : (
              <span className="inline-flex items-center">
                <svg
                  className="w-4 h-4 mr-2 text-blue-600"
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
                Regular Event
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            The event type cannot be changed after event creation
          </p>
        </div>

        {/* Event Name */}
        <div className="mb-6">
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Event Name *
          </label>
          <input
            type="text"
            id="name"
            value={values.name}
            onChange={(e) => onFieldChange("name", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={100}
            disabled={!canUpdate || isSubmitting}
          />
        </div>

        {/* Venue */}
        <div className="mb-6">
          <label
            htmlFor="venue"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Venue (Optional)
          </label>
          <input
            type="text"
            id="venue"
            value={values.venue}
            onChange={(e) => onFieldChange("venue", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={200}
            disabled={!canUpdate || isSubmitting}
            placeholder="e.g., London Studio"
          />
        </div>

        {/* Parent Event Group - Only for regular events */}
        {event.eventType === "event" && (
          <div className="mb-6">
            <label
              htmlFor="parent-event"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Event Group (Optional)
            </label>
            <select
              id="parent-event"
              value={values.parentEventId}
              onChange={(e) => onFieldChange("parentEventId", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!canUpdate || isSubmitting}
            >
              <option value="">None - Standalone Event</option>
              {eventGroups.map((evt) => (
                <option key={fromBranded(evt.id)} value={fromBranded(evt.id)}>
                  {evt.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Make this event part of a larger event group (e.g., a festival or
              conference)
            </p>
          </div>
        )}

        {/* Maximum Attendees */}
        <div className="mb-6">
          <label
            htmlFor="max-attendees"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Maximum Attendees (Optional)
          </label>
          <input
            type="number"
            id="max-attendees"
            value={values.maxAttendees}
            onChange={(e) => onFieldChange("maxAttendees", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., 500"
            min="1"
            disabled={!canUpdate || isSubmitting}
          />
          <p className="mt-1 text-xs text-gray-500">
            Set a capacity limit for this event
          </p>
        </div>

        {/* Date and Start Time */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="scheduled-date"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Date *
            </label>
            <input
              type="date"
              id="scheduled-date"
              value={values.scheduledDate}
              onChange={(e) => onFieldChange("scheduledDate", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!canUpdate || isSubmitting}
            />
          </div>
          <div>
            <label
              htmlFor="scheduled-start-time"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Start Time *
            </label>
            <input
              type="time"
              id="scheduled-start-time"
              value={values.scheduledStartTime}
              onChange={(e) =>
                onFieldChange("scheduledStartTime", e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!canUpdate || isSubmitting}
            />
          </div>
        </div>

        {/* Optional End Date and Time */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="scheduled-end-date"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              End Date (Optional)
            </label>
            <input
              type="date"
              id="scheduled-end-date"
              value={values.scheduledEndDate}
              onChange={(e) =>
                onFieldChange("scheduledEndDate", e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!canUpdate || isSubmitting}
            />
          </div>
          <div>
            <label
              htmlFor="scheduled-end-time"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              End Time (Optional)
            </label>
            <input
              type="time"
              id="scheduled-end-time"
              value={values.scheduledEndTime}
              onChange={(e) =>
                onFieldChange("scheduledEndTime", e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!canUpdate || isSubmitting || !values.scheduledEndDate}
            />
          </div>
        </div>

        {/* Status */}
        <div className="mb-6">
          <label
            htmlFor="status"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Status
          </label>
          <select
            id="status"
            value={values.status}
            onChange={(e) =>
              onFieldChange(
                "status",
                e.target.value as "draft" | "active" | "live" | "ended",
              )
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!canUpdate || isSubmitting}
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="live">Live</option>
            <option value="ended">Ended</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Draft: Still being set up | Active: Ready to go live | Live:
            Happening now | Ended: Finished
          </p>
        </div>

        {/* Timezone Display */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Timezone
          </label>
          <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-600">
            {event.timezone}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Timezone cannot be changed after event creation
          </p>
        </div>

        {/* Save Button */}
        {canUpdate && (
          <div className="flex justify-between items-center pt-6 border-t">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>

            {canDelete && (
              <>
                {event.isActive ? (
                  <button
                    type="button"
                    onClick={onArchive}
                    className="px-6 py-2 text-sm font-medium text-red-600 bg-white border border-red-600 rounded-md hover:bg-red-50"
                  >
                    Archive Event
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onUnarchive}
                    className="px-6 py-2 text-sm font-medium text-green-600 bg-white border border-green-600 rounded-md hover:bg-green-50"
                  >
                    Unarchive Event
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
