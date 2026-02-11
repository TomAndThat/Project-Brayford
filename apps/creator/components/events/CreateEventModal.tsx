"use client";

import { useState, useEffect } from "react";
import {
  fromBranded,
  type OrganizationId,
  type BrandDocument,
  type EventDocument,
} from "@brayford/core";
import {
  auth,
  getOrganizationBrands,
  getOrganizationEvents,
} from "@brayford/firebase-utils";

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: OrganizationId;
  organizationName: string;
  onSuccess: (eventId: string) => void;
}

/**
 * Modal for creating a new event
 *
 * Features:
 * - Event name input with validation (1-100 chars)
 * - Brand selection dropdown (required)
 * - Venue input (optional, 1-200 chars)
 * - Date and time pickers with timezone detection
 * - Optional end date/time
 * - Creates event via POST /api/events
 * - Redirects to event settings on success
 */
export default function CreateEventModal({
  isOpen,
  onClose,
  organizationId,
  organizationName,
  onSuccess,
}: CreateEventModalProps) {
  const [name, setName] = useState("");
  const [eventType, setEventType] = useState<"event" | "group">("event");
  const [brandId, setBrandId] = useState("");
  const [venue, setVenue] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledStartTime, setScheduledStartTime] = useState("");
  const [scheduledEndDate, setScheduledEndDate] = useState("");
  const [scheduledEndTime, setScheduledEndTime] = useState("");
  const [timezone, setTimezone] = useState("");
  const [parentEventId, setParentEventId] = useState("");
  const [maxAttendees, setMaxAttendees] = useState("");

  const [brands, setBrands] = useState<BrandDocument[]>([]);
  const [events, setEvents] = useState<EventDocument[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load brands and events on mount
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setLoadingBrands(true);
      setLoadingEvents(true);
      try {
        // Load brands
        const orgBrands = await getOrganizationBrands(organizationId, true);
        setBrands(orgBrands);

        // Auto-select first brand if only one
        if (orgBrands.length === 1) {
          setBrandId(fromBranded(orgBrands[0]!.id));
        }

        // Load events (for parent event group selection - only groups)
        const orgEvents = await getOrganizationEvents(organizationId, true);
        // Filter to only show groups
        setEvents(orgEvents.filter((e) => e.eventType === "group"));
      } catch (error) {
        console.error("Error loading data:", error);
        setError("Failed to load brands and events");
      } finally {
        setLoadingBrands(false);
        setLoadingEvents(false);
      }
    };

    loadData();
  }, [isOpen, organizationId]);

  // Detect user's timezone on mount
  useEffect(() => {
    if (isOpen && !timezone) {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
  }, [isOpen, timezone]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate name
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Event name is required.");
      return;
    }
    if (trimmedName.length > 100) {
      setError("Event name must be 100 characters or less.");
      return;
    }

    // Validate brand
    if (!brandId) {
      setError("Please select a brand.");
      return;
    }

    // Validate venue if provided
    const trimmedVenue = venue.trim();
    if (trimmedVenue && trimmedVenue.length > 200) {
      setError("Venue must be 200 characters or less.");
      return;
    }

    // Validate date and time
    if (!scheduledDate) {
      setError("Event date is required.");
      return;
    }
    if (!scheduledStartTime) {
      setError("Start time is required.");
      return;
    }

    // Validate end date/time if provided
    if (scheduledEndTime && !scheduledEndDate) {
      setError("End date is required when end time is specified.");
      return;
    }

    setIsSubmitting(true);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");

      const requestBody: Record<string, unknown> = {
        brandId,
        organizationId: fromBranded(organizationId),
        name: trimmedName,
        eventType,
        scheduledDate,
        scheduledStartTime,
        timezone,
      };

      if (trimmedVenue) {
        requestBody.venue = trimmedVenue;
      }

      if (scheduledEndDate) {
        requestBody.scheduledEndDate = scheduledEndDate;
      }

      if (scheduledEndTime) {
        requestBody.scheduledEndTime = scheduledEndTime;
      }

      // Only include parentEventId if this is an event (not a group)
      if (eventType === "event" && parentEventId) {
        requestBody.parentEventId = parentEventId;
      }

      if (maxAttendees) {
        const attendeeCount = parseInt(maxAttendees, 10);
        if (attendeeCount > 0) {
          requestBody.maxAttendees = attendeeCount;
        }
      }

      const response = await fetch("/api/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create event");
      }

      const data = await response.json();

      // Reset form
      setName("");
      setEventType("event");
      setBrandId("");
      setVenue("");
      setScheduledDate("");
      setScheduledStartTime("");
      setScheduledEndDate("");
      setScheduledEndTime("");
      setParentEventId("");
      setMaxAttendees("");
      onClose();

      // Call success handler with new event ID
      onSuccess(data.eventId);
    } catch (err) {
      console.error("Error creating event:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create event. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setName("");
      setEventType("event");
      setBrandId("");
      setVenue("");
      setScheduledDate("");
      setScheduledStartTime("");
      setScheduledEndDate("");
      setScheduledEndTime("");
      setParentEventId("");
      setMaxAttendees("");
      setError(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Create New Event
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            Create a new event for {organizationName}
          </p>

          {loadingBrands || loadingEvents ? (
            <div className="text-center py-12">
              <div className="text-gray-600">Loading...</div>
            </div>
          ) : brands.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 mb-4">
                You need to create a brand before creating events.
              </p>
              <button
                onClick={handleClose}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Go to Brands
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Event Name */}
              <div className="mb-4">
                <label
                  htmlFor="event-name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Event Name *
                </label>
                <input
                  type="text"
                  id="event-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Episode 42"
                  maxLength={100}
                  disabled={isSubmitting}
                  autoFocus
                />
              </div>

              {/* Brand Selection */}
              <div className="mb-4">
                <label
                  htmlFor="brand"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Brand *
                </label>
                <select
                  id="brand"
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isSubmitting}
                >
                  <option value="">Select a brand...</option>
                  {brands.map((brand) => (
                    <option
                      key={fromBranded(brand.id)}
                      value={fromBranded(brand.id)}
                    >
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Event Type Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="eventType"
                      value="event"
                      checked={eventType === "event"}
                      onChange={(e) => {
                        setEventType(e.target.value as "event" | "group");
                        // Clear parent if switching to group
                        if (e.target.value === "group") {
                          setParentEventId("");
                        }
                      }}
                      className="mr-2"
                      disabled={isSubmitting}
                    />
                    <span className="text-sm text-gray-700">Regular Event</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="eventType"
                      value="group"
                      checked={eventType === "group"}
                      onChange={(e) => {
                        setEventType(e.target.value as "event" | "group");
                        // Clear parent if switching to group
                        if (e.target.value === "group") {
                          setParentEventId("");
                        }
                      }}
                      className="mr-2"
                      disabled={isSubmitting}
                    />
                    <span className="text-sm text-gray-700">Event Group</span>
                  </label>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {eventType === "event"
                    ? "A regular event (can optionally belong to a group)"
                    : "A container for multiple related events (e.g., a festival or conference)"}
                </p>
              </div>

              {/* Venue */}
              <div className="mb-4">
                <label
                  htmlFor="venue"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Venue (Optional)
                </label>
                <input
                  type="text"
                  id="venue"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., London Studio"
                  maxLength={200}
                  disabled={isSubmitting}
                />
              </div>

              {/* Parent Event Group - Only for regular events */}
              {eventType === "event" && (
                <div className="mb-4">
                  <label
                    htmlFor="parent-event"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Event Group (Optional)
                  </label>
                  <select
                    id="parent-event"
                    value={parentEventId}
                    onChange={(e) => setParentEventId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isSubmitting}
                  >
                    <option value="">None - Standalone Event</option>
                    {events.map((event) => (
                      <option
                        key={fromBranded(event.id)}
                        value={fromBranded(event.id)}
                      >
                        {event.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Make this event part of a larger event group (e.g., a
                    festival or conference)
                  </p>
                </div>
              )}

              {/* Maximum Attendees */}
              <div className="mb-4">
                <label
                  htmlFor="max-attendees"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Maximum Attendees (Optional)
                </label>
                <input
                  type="number"
                  id="max-attendees"
                  value={maxAttendees}
                  onChange={(e) => setMaxAttendees(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 500"
                  min="1"
                  disabled={isSubmitting}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Set a capacity limit for this event
                </p>
              </div>

              {/* Date and Start Time */}
              <div className="mb-4 grid grid-cols-2 gap-4">
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
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isSubmitting}
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
                    value={scheduledStartTime}
                    onChange={(e) => setScheduledStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Optional End Date and Time */}
              <div className="mb-4 grid grid-cols-2 gap-4">
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
                    value={scheduledEndDate}
                    onChange={(e) => setScheduledEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isSubmitting}
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
                    value={scheduledEndTime}
                    onChange={(e) => setScheduledEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isSubmitting || !scheduledEndDate}
                  />
                </div>
              </div>

              {/* Timezone Display */}
              <div className="mb-6">
                <p className="text-xs text-gray-500">
                  Timezone: {timezone || "Detecting..."}
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Create Event"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
