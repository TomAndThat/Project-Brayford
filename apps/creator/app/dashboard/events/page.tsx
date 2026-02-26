"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEventsPageData, filterEvents } from "@/hooks/use-events-page-data";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import CreateEventModal from "@/components/events/CreateEventModal";
import EventsFilterTabs from "@/components/events/EventsFilterTabs";
import EventsTable from "@/components/events/EventsTable";

export default function EventsPage() {
  const router = useRouter();
  const {
    user,
    loading,
    organization,
    currentMember,
    events,
    brands,
    filter,
    setFilter,
    canCreate,
    handleSignOut,
  } = useEventsPageData();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // ── Loading / guard states ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user || !organization || !currentMember) {
    return null;
  }

  const filteredEvents = filterEvents(events, filter);

  const handleCreateEvent = () => {
    setIsCreateModalOpen(true);
  };

  const handleCreateSuccess = (eventId: string) => {
    router.push(`/dashboard/events/${eventId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        user={user}
        organizationName={organization.name}
        onSignOut={handleSignOut}
        currentMember={currentMember}
        pageTitle="Events"
      />

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
          <EventsFilterTabs
            events={events}
            filter={filter}
            onFilterChange={setFilter}
          />
        )}

        {/* Events Table */}
        <EventsTable
          filteredEvents={filteredEvents}
          allEvents={events}
          brands={brands}
          canCreate={canCreate}
          filterLabel={filter}
          onCreateEvent={handleCreateEvent}
        />
      </main>

      {/* Create Event Modal */}
      <CreateEventModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        organizationId={organization.id}
        organizationName={organization.name}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
