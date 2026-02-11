"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  getUserOrganizations,
  getEvent,
  getBrand,
  getOrganization,
  getOrganizationEvents,
  auth,
} from "@brayford/firebase-utils";
import {
  toBranded,
  fromBranded,
  type UserId,
  type EventId,
  type EventDocument,
  type BrandDocument,
  type OrganizationDocument,
  type OrganizationMemberDocument,
  hasPermission,
  EVENTS_UPDATE,
  EVENTS_DELETE,
} from "@brayford/core";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import QRCodeManagement from "@/components/events/QRCodeManagement";

export default function EventSettingsPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;

  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<OrganizationDocument | null>(
    null,
  );
  const [currentMember, setCurrentMember] =
    useState<OrganizationMemberDocument | null>(null);
  const [event, setEvent] = useState<EventDocument | null>(null);
  const [brand, setBrand] = useState<BrandDocument | null>(null);
  const [events, setEvents] = useState<EventDocument[]>([]);
  const [childEvents, setChildEvents] = useState<EventDocument[]>([]);

  // Form state
  const [name, setName] = useState("");
  const [venue, setVenue] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledStartTime, setScheduledStartTime] = useState("");
  const [scheduledEndDate, setScheduledEndDate] = useState("");
  const [scheduledEndTime, setScheduledEndTime] = useState("");
  const [parentEventId, setParentEventId] = useState("");
  const [maxAttendees, setMaxAttendees] = useState("");
  const [status, setStatus] = useState<"draft" | "active" | "live" | "ended">(
    "draft",
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [showUnarchiveDialog, setShowUnarchiveDialog] = useState(false);
  const [isUnarchiving, setIsUnarchiving] = useState(false);

  const loadEventData = useCallback(async () => {
    if (!user || !eventId) return;

    try {
      const userId = toBranded<UserId>(user.uid);
      const memberships = await getUserOrganizations(userId);

      if (memberships.length === 0) {
        router.push("/onboarding");
        return;
      }

      const currentMembership = memberships[0]!;
      setCurrentMember(currentMembership);

      // Load organization
      const orgId = currentMembership.organizationId;
      const org = await getOrganization(orgId);

      if (!org) {
        alert("Organisation not found");
        router.push("/dashboard");
        return;
      }

      setOrganization(org);

      // Load event
      const eventData = await getEvent(toBranded<EventId>(eventId));

      if (!eventData) {
        alert("Event not found");
        router.push("/dashboard/events");
        return;
      }

      setEvent(eventData);
      setName(eventData.name);
      setVenue(eventData.venue || "");
      setScheduledDate(eventData.scheduledDate.toISOString().split("T")[0]!);
      setScheduledStartTime(eventData.scheduledStartTime);
      setScheduledEndDate(
        eventData.scheduledEndDate
          ? eventData.scheduledEndDate.toISOString().split("T")[0]!
          : "",
      );
      setScheduledEndTime(eventData.scheduledEndTime || "");
      setParentEventId(eventData.parentEventId || "");
      setMaxAttendees(
        eventData.maxAttendees ? String(eventData.maxAttendees) : "",
      );
      setStatus(eventData.status);

      // Load brand
      const brandData = await getBrand(eventData.brandId);
      if (brandData) {
        setBrand(brandData);
      }

      // Load all organization events for parent selection (only groups)
      const orgEvents = await getOrganizationEvents(orgId, true);
      // Filter to only event groups, excluding the current event
      setEvents(
        orgEvents.filter(
          (e) => e.eventType === "group" && e.id !== eventData.id,
        ),
      );

      // Load child events if this is an event group
      const children = orgEvents.filter(
        (e) =>
          e.eventType === "event" &&
          e.parentEventId &&
          fromBranded(e.parentEventId as any) === eventId,
      );
      setChildEvents(children);
    } catch (error) {
      console.error("Error loading event data:", error);
      alert("Failed to load event");
      router.push("/dashboard/events");
    } finally {
      setLoading(false);
    }
  }, [user, eventId, router]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/signin");
      return;
    }

    if (user) {
      loadEventData();
    }
  }, [user, authLoading, router, loadEventData]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/signin");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNotification({
        type: "error",
        message: "Event name is required",
      });
      setTimeout(() => setNotification(null), 5000);
      return;
    }

    const trimmedVenue = venue.trim();
    if (trimmedVenue && trimmedVenue.length > 200) {
      setNotification({
        type: "error",
        message: "Venue must be 200 characters or less",
      });
      setTimeout(() => setNotification(null), 5000);
      return;
    }

    if (!scheduledDate || !scheduledStartTime) {
      setNotification({
        type: "error",
        message: "Date and start time are required",
      });
      setTimeout(() => setNotification(null), 5000);
      return;
    }

    if (scheduledEndTime && !scheduledEndDate) {
      setNotification({
        type: "error",
        message: "End date is required when end time is specified",
      });
      setTimeout(() => setNotification(null), 5000);
      return;
    }

    setIsSubmitting(true);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");

      const updateData: Record<string, unknown> = {
        name: trimmedName,
        scheduledDate,
        scheduledStartTime,
        status,
      };

      if (trimmedVenue) {
        updateData.venue = trimmedVenue;
      }

      if (scheduledEndDate) {
        updateData.scheduledEndDate = scheduledEndDate;
      }

      if (scheduledEndTime) {
        updateData.scheduledEndTime = scheduledEndTime;
      }

      if (parentEventId) {
        updateData.parentEventId = parentEventId;
      } else if (event?.parentEventId) {
        // Explicitly remove parentEventId if it was cleared
        updateData.parentEventId = null;
      }

      if (maxAttendees) {
        const attendeeCount = parseInt(maxAttendees, 10);
        if (attendeeCount > 0) {
          updateData.maxAttendees = attendeeCount;
        }
      } else if (event?.maxAttendees) {
        // Explicitly remove maxAttendees if it was cleared
        updateData.maxAttendees = null;
      }

      const response = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update event");
      }

      setNotification({
        type: "success",
        message: "Event updated successfully",
      });
      setTimeout(() => setNotification(null), 5000);

      // Reload event data
      await loadEventData();
    } catch (error) {
      console.error("Error updating event:", error);
      setNotification({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to update event. Please try again.",
      });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async () => {
    setIsArchiving(true);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");

      const response = await fetch(`/api/events/${eventId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to archive event");
      }

      // Navigate back to events list
      router.push("/dashboard/events");
    } catch (error) {
      console.error("Error archiving event:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to archive event. Please try again.",
      );
    } finally {
      setIsArchiving(false);
      setShowArchiveDialog(false);
    }
  };

  const handleUnarchive = async () => {
    setIsUnarchiving(true);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");

      const response = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ isActive: true }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to unarchive event");
      }

      setNotification({
        type: "success",
        message: "Event unarchived successfully",
      });
      setTimeout(() => setNotification(null), 5000);

      // Reload event data
      await loadEventData();
    } catch (error) {
      console.error("Error unarchiving event:", error);
      setNotification({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to unarchive event. Please try again.",
      });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setIsUnarchiving(false);
      setShowUnarchiveDialog(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user || !organization || !currentMember || !event || !brand) {
    return null;
  }

  // Check permissions
  const canUpdate = hasPermission(currentMember, EVENTS_UPDATE);
  const canDelete = hasPermission(currentMember, EVENTS_DELETE);

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        user={user}
        organizationName={organization.name}
        onSignOut={handleSignOut}
        pageTitle="Event Settings"
      />

      {/* Notification */}
      {notification && (
        <div className="fixed top-20 right-4 z-50 max-w-md">
          <div
            className={`p-4 rounded-lg shadow-lg ${
              notification.type === "success"
                ? "bg-green-50 border border-green-200"
                : "bg-red-50 border border-red-200"
            }`}
          >
            <div className="flex items-start">
              <div className="flex-1">
                <p
                  className={`text-sm font-medium ${
                    notification.type === "success"
                      ? "text-green-800"
                      : "text-red-800"
                  }`}
                >
                  {notification.message}
                </p>
              </div>
              <button
                onClick={() => setNotification(null)}
                className="ml-4 text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-6">
          <button
            onClick={() => router.push("/dashboard/events")}
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center"
          >
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Events
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Event Settings
          </h2>

          <form onSubmit={handleSubmit}>
            {/* Brand (Read-only) */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Brand
              </label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-600">
                {brand.name}
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
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
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
                  value={parentEventId}
                  onChange={(e) => setParentEventId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={!canUpdate || isSubmitting}
                >
                  <option value="">None - Standalone Event</option>
                  {events.map((evt) => (
                    <option
                      key={fromBranded(evt.id)}
                      value={fromBranded(evt.id)}
                    >
                      {evt.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Make this event part of a larger event group (e.g., a festival
                  or conference)
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
                value={maxAttendees}
                onChange={(e) => setMaxAttendees(e.target.value)}
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
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
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
                  value={scheduledStartTime}
                  onChange={(e) => setScheduledStartTime(e.target.value)}
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
                  value={scheduledEndDate}
                  onChange={(e) => setScheduledEndDate(e.target.value)}
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
                  value={scheduledEndTime}
                  onChange={(e) => setScheduledEndTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={!canUpdate || isSubmitting || !scheduledEndDate}
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
                value={status}
                onChange={(e) =>
                  setStatus(
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
                        onClick={() => setShowArchiveDialog(true)}
                        className="px-6 py-2 text-sm font-medium text-red-600 bg-white border border-red-600 rounded-md hover:bg-red-50"
                      >
                        Archive Event
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowUnarchiveDialog(true)}
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

        {/* Child Events Section (for Event Groups) */}
        {childEvents.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Child Events
            </h2>
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
                        {child.status.charAt(0).toUpperCase() +
                          child.status.slice(1)}
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
        )}

        {/* QR Code Management Section */}
        <div className="mt-8">
          <QRCodeManagement
            eventId={toBranded(eventId)}
            organizationId={event.organizationId}
            canUpdate={canUpdate}
          />
        </div>
      </main>

      {/* Archive Confirmation Dialog */}
      {showArchiveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Archive Event?
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to archive &quot;{event.name}&quot;?
              Archived events are hidden from the main list but can be
              unarchived at any time.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowArchiveDialog(false)}
                disabled={isArchiving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleArchive}
                disabled={isArchiving}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 disabled:opacity-50"
              >
                {isArchiving ? "Archiving..." : "Archive Event"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unarchive Confirmation Dialog */}
      {showUnarchiveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Unarchive Event?
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Unarchive &quot;{event.name}&quot; to make it visible in the main
              events list again.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowUnarchiveDialog(false)}
                disabled={isUnarchiving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUnarchive}
                disabled={isUnarchiving}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {isUnarchiving ? "Unarchiving..." : "Unarchive Event"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
