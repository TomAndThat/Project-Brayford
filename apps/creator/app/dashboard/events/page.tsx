"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  getUserOrganizations,
  getOrganization,
  getOrganizationEvents,
  getOrganizationBrands,
} from "@brayford/firebase-utils";
import {
  toBranded,
  fromBranded,
  type UserId,
  type OrganizationDocument,
  type OrganizationMemberDocument,
  type EventDocument,
  type BrandDocument,
  hasPermission,
  EVENTS_VIEW,
  EVENTS_CREATE,
} from "@brayford/core";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import CreateEventModal from "@/components/events/CreateEventModal";

type EventFilter =
  | "active"
  | "archived"
  | "all"
  | "groups"
  | "standalone"
  | "children";

export default function EventsPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<OrganizationDocument | null>(
    null,
  );
  const [currentMember, setCurrentMember] =
    useState<OrganizationMemberDocument | null>(null);
  const [events, setEvents] = useState<EventDocument[]>([]);
  const [brands, setBrands] = useState<BrandDocument[]>([]);
  const [filter, setFilter] = useState<EventFilter>("active");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const loadUserData = useCallback(async () => {
    if (!user) return;

    try {
      const userId = toBranded<UserId>(user.uid);
      const memberships = await getUserOrganizations(userId);

      if (memberships.length === 0) {
        router.push("/onboarding");
        return;
      }

      // Get first organization and current member record
      const currentMembership = memberships[0]!;
      setCurrentMember(currentMembership);

      const orgId = currentMembership.organizationId;
      const org = await getOrganization(orgId);

      if (org) {
        setOrganization(org);
        // Load all events (including archived) for filtering
        const orgEvents = await getOrganizationEvents(orgId, false);
        setEvents(orgEvents);

        // Load brands for display
        const orgBrands = await getOrganizationBrands(orgId, true);
        setBrands(orgBrands);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    } finally {
      setLoading(false);
    }
  }, [user, router]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/signin");
      return;
    }

    if (user) {
      loadUserData();
    }
  }, [user, authLoading, router, loadUserData]);

  // Check permissions after data loads
  useEffect(() => {
    if (!loading && currentMember && organization) {
      if (!hasPermission(currentMember, EVENTS_VIEW)) {
        alert("You don't have permission to view events.");
        router.push("/dashboard");
      }
    }
  }, [loading, currentMember, organization, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/signin");
  };

  const handleCreateEvent = () => {
    setIsCreateModalOpen(true);
  };

  const handleCreateSuccess = (eventId: string) => {
    // Redirect to event settings page
    router.push(`/dashboard/events/${eventId}`);
  };

  // Get brand name by ID
  const getBrandName = (brandId: string): string => {
    const brand = brands.find((b) => fromBranded(b.id) === brandId);
    return brand?.name || "Unknown Brand";
  };

  // Format date for display
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Format time for display
  const formatTime = (time: string): string => {
    return time; // Already in HH:MM format
  };

  // Get status badge color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case "draft":
        return "bg-gray-100 text-gray-800";
      case "active":
        return "bg-green-100 text-green-800";
      case "live":
        return "bg-blue-100 text-blue-800";
      case "ended":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Check if event is an event group
  const isEventGroup = (event: EventDocument): boolean => {
    return event.eventType === "group";
  };

  // Get count of child events
  const getChildEventCount = (eventId: string): number => {
    return events.filter(
      (e) =>
        e.eventType === "event" &&
        e.parentEventId &&
        fromBranded(e.parentEventId as any) === eventId,
    ).length;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user || !organization || !currentMember) {
    return null;
  }

  // Check permissions for current user
  const canCreate = hasPermission(currentMember, EVENTS_CREATE);

  // Filter events based on selected filter
  const filteredEvents = events.filter((event) => {
    // First apply active/archived filter for non-type-specific filters
    if (filter === "active") return event.isActive;
    if (filter === "archived") return !event.isActive;

    // Type-specific filters (apply to active events only)
    if (filter === "groups") {
      return event.isActive && isEventGroup(event);
    }
    if (filter === "standalone") {
      return (
        event.isActive && event.eventType === "event" && !event.parentEventId
      );
    }
    if (filter === "children") {
      return (
        event.isActive && event.eventType === "event" && !!event.parentEventId
      );
    }

    return true; // "all"
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        user={user}
        organizationName={organization.name}
        onSignOut={handleSignOut}
        pageTitle="Events"
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Header with Create Button */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Events</h2>
            <p className="text-gray-600 mt-1">
              Manage your organisation&apos;s events
            </p>
          </div>
          {canCreate && (
            <button
              onClick={handleCreateEvent}
              data-testid="create-event-btn"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create Event
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        {events.length > 0 && (
          <div className="mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                <button
                  onClick={() => setFilter("active")}
                  className={`${
                    filter === "active"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                  data-testid="filter-active"
                >
                  Active
                  <span
                    className={`ml-2 ${
                      filter === "active"
                        ? "bg-blue-100 text-blue-600"
                        : "bg-gray-100 text-gray-900"
                    } py-0.5 px-2.5 rounded-full text-xs font-medium`}
                  >
                    {events.filter((e) => e.isActive).length}
                  </span>
                </button>
                <button
                  onClick={() => setFilter("groups")}
                  className={`${
                    filter === "groups"
                      ? "border-purple-500 text-purple-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  Event Groups
                  <span
                    className={`ml-2 ${
                      filter === "groups"
                        ? "bg-purple-100 text-purple-600"
                        : "bg-gray-100 text-gray-900"
                    } py-0.5 px-2.5 rounded-full text-xs font-medium`}
                  >
                    {events.filter((e) => e.isActive && isEventGroup(e)).length}
                  </span>
                </button>
                <button
                  onClick={() => setFilter("standalone")}
                  className={`${
                    filter === "standalone"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  Standalone
                  <span
                    className={`ml-2 ${
                      filter === "standalone"
                        ? "bg-blue-100 text-blue-600"
                        : "bg-gray-100 text-gray-900"
                    } py-0.5 px-2.5 rounded-full text-xs font-medium`}
                  >
                    {
                      events.filter(
                        (e) =>
                          e.isActive &&
                          e.eventType === "event" &&
                          !e.parentEventId,
                      ).length
                    }
                  </span>
                </button>
                <button
                  onClick={() => setFilter("children")}
                  className={`${
                    filter === "children"
                      ? "border-indigo-500 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  Child Events
                  <span
                    className={`ml-2 ${
                      filter === "children"
                        ? "bg-indigo-100 text-indigo-600"
                        : "bg-gray-100 text-gray-900"
                    } py-0.5 px-2.5 rounded-full text-xs font-medium`}
                  >
                    {events.filter((e) => e.isActive && e.parentEventId).length}
                  </span>
                </button>
                <button
                  onClick={() => setFilter("archived")}
                  className={`${
                    filter === "archived"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                  data-testid="filter-archived"
                >
                  Archived
                  <span
                    className={`ml-2 ${
                      filter === "archived"
                        ? "bg-blue-100 text-blue-600"
                        : "bg-gray-100 text-gray-900"
                    } py-0.5 px-2.5 rounded-full text-xs font-medium`}
                  >
                    {events.filter((e) => !e.isActive).length}
                  </span>
                </button>
                <button
                  onClick={() => setFilter("all")}
                  className={`${
                    filter === "all"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                  data-testid="filter-all"
                >
                  All
                  <span
                    className={`ml-2 ${
                      filter === "all"
                        ? "bg-blue-100 text-blue-600"
                        : "bg-gray-100 text-gray-900"
                    } py-0.5 px-2.5 rounded-full text-xs font-medium`}
                  >
                    {events.length}
                  </span>
                </button>
              </nav>
            </div>
          </div>
        )}

        {/* Events List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {filteredEvents.length === 0 && events.length === 0 ? (
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
                  onClick={handleCreateEvent}
                  className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Create Your First Event
                </button>
              )}
            </div>
          ) : filteredEvents.length === 0 ? (
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
                No {filter} events
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                {filter === "active"
                  ? "All events are currently archived."
                  : "No archived events found."}
              </p>
            </div>
          ) : (
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
                    Date & Time
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
                {filteredEvents.map((event) => {
                  return (
                    <tr
                      key={fromBranded(event.id)}
                      className={`hover:bg-gray-50 cursor-pointer ${
                        !event.isActive ? "opacity-60" : ""
                      }`}
                      onClick={() =>
                        router.push(
                          `/dashboard/events/${fromBranded(event.id)}`,
                        )
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
                                // Folder icon for event groups
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                                />
                              ) : event.parentEventId ? (
                                // Sub-item icon for child events
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5l7 7-7 7"
                                />
                              ) : (
                                // Calendar icon for standalone events
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
                                  {getChildEventCount(fromBranded(event.id))})
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
                        {getBrandName(fromBranded(event.brandId))}
                      </td>

                      {/* Date & Time */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>{formatDate(event.scheduledDate)}</div>
                        <div className="text-xs text-gray-400">
                          {formatTime(event.scheduledStartTime)}
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
                          {event.status.charAt(0).toUpperCase() +
                            event.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Create Event Modal */}
      {currentMember && organization && (
        <CreateEventModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          organizationId={organization.id}
          organizationName={organization.name}
          onSuccess={handleCreateSuccess}
        />
      )}
    </div>
  );
}
