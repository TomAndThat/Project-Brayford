"use client";

import { useState, useEffect } from "react";
import {
  fromBranded,
  type OrganizationId,
  type BrandDocument,
} from "@brayford/core";
import { auth, getOrganizationBrands } from "@brayford/firebase-utils";

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
  const [brandId, setBrandId] = useState("");
  const [venue, setVenue] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledStartTime, setScheduledStartTime] = useState("");
  const [scheduledEndDate, setScheduledEndDate] = useState("");
  const [scheduledEndTime, setScheduledEndTime] = useState("");
  const [timezone, setTimezone] = useState("");

  const [brands, setBrands] = useState<BrandDocument[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load brands on mount
  useEffect(() => {
    if (!isOpen) return;

    const loadBrands = async () => {
      setLoadingBrands(true);
      try {
        const orgBrands = await getOrganizationBrands(organizationId, true);
        setBrands(orgBrands);

        // Auto-select first brand if only one
        if (orgBrands.length === 1) {
          setBrandId(fromBranded(orgBrands[0]!.id));
        }
      } catch (error) {
        console.error("Error loading brands:", error);
        setError("Failed to load brands");
      } finally {
        setLoadingBrands(false);
      }
    };

    loadBrands();
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
      setBrandId("");
      setVenue("");
      setScheduledDate("");
      setScheduledStartTime("");
      setScheduledEndDate("");
      setScheduledEndTime("");
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
      setBrandId("");
      setVenue("");
      setScheduledDate("");
      setScheduledStartTime("");
      setScheduledEndDate("");
      setScheduledEndTime("");
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

          {loadingBrands ? (
            <div className="text-center py-12">
              <div className="text-gray-600">Loading brands...</div>
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
