"use client";

import { useRouter, useParams } from "next/navigation";
import {
  toBranded,
  hasPermission,
  EVENTS_UPDATE,
  EVENTS_DELETE,
} from "@brayford/core";
import { useEventData } from "@/hooks/use-event-data";
import { useEventForm } from "@/hooks/use-event-form";
import { useEventArchive } from "@/hooks/use-event-archive";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import EventSettingsForm from "@/components/events/EventSettingsForm";
import EventChildrenList from "@/components/events/EventChildrenList";
import QRCodeManagement from "@/components/events/QRCodeManagement";
import ConfirmDialog from "@/components/shared/ConfirmDialog";

export default function EventSettingsPage() {
  const router = useRouter();
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;

  // ── Data loading & auth ─────────────────────────────────────────────
  const {
    user,
    loading,
    event,
    brand,
    organization,
    currentMember,
    eventGroups,
    childEvents,
    reload,
    handleSignOut,
  } = useEventData(eventId);

  // ── Form state ──────────────────────────────────────────────────────
  const form = useEventForm(event, eventId, reload);

  // ── Archive/unarchive ───────────────────────────────────────────────
  const archive = useEventArchive(eventId, reload);

  // ── Loading / guard states ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user || !organization || !currentMember || !event || !brand) {
    return null;
  }

  const canUpdate = hasPermission(currentMember, EVENTS_UPDATE);
  const canDelete = hasPermission(currentMember, EVENTS_DELETE);

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        user={user}
        organizationName={organization.name}
        onSignOut={handleSignOut}
        currentMember={currentMember}
        pageTitle="Event Settings"
      />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back link */}
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

        {/* Event Settings Form */}
        <EventSettingsForm
          event={event}
          brandName={brand.name}
          values={form.values}
          onFieldChange={form.setField}
          eventGroups={eventGroups}
          canUpdate={canUpdate}
          canDelete={canDelete}
          isSubmitting={form.isSubmitting}
          onSubmit={form.handleSubmit}
          onArchive={() => archive.setShowArchiveDialog(true)}
          onUnarchive={() => archive.setShowUnarchiveDialog(true)}
        />

        {/* Child Events (for event groups) */}
        <EventChildrenList childEvents={childEvents} />

        {/* QR Code Management */}
        <div className="mt-8">
          <QRCodeManagement
            eventId={toBranded(eventId)}
            organizationId={event.organizationId}
            canUpdate={canUpdate}
          />
        </div>
      </main>

      {/* Archive Confirmation Dialog */}
      <ConfirmDialog
        isOpen={archive.showArchiveDialog}
        title="Archive Event?"
        message={`Are you sure you want to archive "${event.name}"? Archived events are hidden from the main list but can be unarchived at any time.`}
        confirmLabel={archive.isArchiving ? "Archiving..." : "Archive Event"}
        variant="danger"
        onConfirm={archive.handleArchive}
        onCancel={() => archive.setShowArchiveDialog(false)}
      />

      {/* Unarchive Confirmation Dialog */}
      <ConfirmDialog
        isOpen={archive.showUnarchiveDialog}
        title="Unarchive Event?"
        message={`Unarchive "${event.name}" to make it visible in the main events list again.`}
        confirmLabel={
          archive.isUnarchiving ? "Unarchiving..." : "Unarchive Event"
        }
        variant="warning"
        onConfirm={archive.handleUnarchive}
        onCancel={() => archive.setShowUnarchiveDialog(false)}
      />
    </div>
  );
}
