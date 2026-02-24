"use client";

import { useCallback, useEffect, useState } from "react";
import type { EventDocument, EventStatus } from "@brayford/core";
import { auth } from "@brayford/firebase-utils";

// ===== Types =====

interface EventControlViewProps {
  event: EventDocument;
}

interface Transition {
  label: string;
  targetStatus: EventStatus;
  variant: "primary" | "secondary" | "danger";
  requiresConfirmation: boolean;
}

// ===== Status config =====

const STATUS_CONFIG: Record<
  EventStatus,
  {
    label: string;
    description: string;
    badge: string;
    dot: string;
    pulse: boolean;
    forward: Transition | null;
    backward: Transition | null;
  }
> = {
  draft: {
    label: "Draft",
    description:
      "This event is being set up and is not yet visible to your audience. Activate it when you are ready to open audience join links.",
    badge: "bg-gray-700/40 border border-gray-600 text-gray-300",
    dot: "bg-gray-400",
    pulse: false,
    forward: {
      label: "Activate Event",
      targetStatus: "active",
      variant: "primary",
      requiresConfirmation: false,
    },
    backward: null,
  },
  active: {
    label: "Ready",
    description:
      "This event is ready and audience join links are now active. Your audience can join, but the show has not started. Go live when you are ready to begin.",
    badge: "bg-green-900/30 border border-green-600 text-green-400",
    dot: "bg-green-500",
    pulse: false,
    forward: {
      label: "Go Live",
      targetStatus: "live",
      variant: "primary",
      requiresConfirmation: false,
    },
    backward: {
      label: "Revert to Draft",
      targetStatus: "draft",
      variant: "secondary",
      requiresConfirmation: false,
    },
  },
  live: {
    label: "Live",
    description:
      "Your show is live. Audience members can see your broadcast in real time. End the event when the show is over.",
    badge: "bg-red-900/30 border border-red-500 text-red-400",
    dot: "bg-red-500",
    pulse: true,
    forward: {
      label: "End Event",
      targetStatus: "ended",
      variant: "danger",
      requiresConfirmation: true,
    },
    backward: {
      label: "Revert to Ready",
      targetStatus: "active",
      variant: "secondary",
      requiresConfirmation: false,
    },
  },
  ended: {
    label: "Ended",
    description:
      "This event has concluded. No further changes to the event status can be made from the studio.",
    badge: "bg-gray-700/40 border border-gray-600 text-gray-400",
    dot: "bg-gray-500",
    pulse: false,
    forward: null,
    backward: null,
  },
};

// ===== Confirmation dialog =====

interface EndEventConfirmDialogProps {
  isOpen: boolean;
  eventName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function EndEventConfirmDialog({
  isOpen,
  eventName,
  onConfirm,
  onCancel,
}: EndEventConfirmDialogProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        onConfirm();
      }
    },
    [isOpen, onCancel, onConfirm],
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-sm rounded-lg bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-900">End Event</h3>
            <button
              onClick={onCancel}
              className="rounded-md p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-4 space-y-2">
            <p className="text-sm text-gray-600">
              Are you sure you want to end{" "}
              <span className="font-semibold text-gray-900">{eventName}</span>?
            </p>
            <p className="text-sm text-gray-500">
              All audience members will be disconnected immediately and the
              event will be marked as ended.
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              onClick={onCancel}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
            >
              End Event
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Main component =====

/**
 * Event Control View — studio panel for managing event lifecycle status.
 *
 * Displays the current status with contextual guidance and exposes:
 * - A primary forward-transition action (e.g. "Activate", "Go Live", "End Event")
 * - An optional secondary backward-transition action for error recovery
 * - A confirmation dialog before the irreversible "End Event" transition
 *
 * The event prop is expected to be a live real-time subscription so that
 * status changes made elsewhere (e.g. another admin session) are reflected
 * immediately without a page refresh.
 */
export default function EventControlView({ event }: EventControlViewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<Transition | null>(
    null,
  );

  const config = STATUS_CONFIG[event.status];

  const executeTransition = useCallback(
    async (transition: Transition) => {
      setLoading(true);
      setError(null);

      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) {
          setError("You must be signed in to change the event status.");
          return;
        }

        const response = await fetch(`/api/events/${event.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ status: transition.targetStatus }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          setError(
            (data as { error?: string }).error ??
              "Failed to update event status. Please try again.",
          );
        }
        // On success the onSnapshot listener in the parent will update the
        // event prop automatically — no local state update needed here.
      } catch {
        setError(
          "An unexpected error occurred. Please check your connection and try again.",
        );
      } finally {
        setLoading(false);
      }
    },
    [event.id],
  );

  const handleTransitionRequest = useCallback(
    (transition: Transition) => {
      if (transition.requiresConfirmation) {
        setPendingTransition(transition);
        setConfirmOpen(true);
      } else {
        void executeTransition(transition);
      }
    },
    [executeTransition],
  );

  const handleConfirm = useCallback(() => {
    setConfirmOpen(false);
    if (pendingTransition) {
      void executeTransition(pendingTransition);
      setPendingTransition(null);
    }
  }, [pendingTransition, executeTransition]);

  const handleCancel = useCallback(() => {
    setConfirmOpen(false);
    setPendingTransition(null);
  }, []);

  return (
    <>
      <EndEventConfirmDialog
        isOpen={confirmOpen}
        eventName={event.name}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Event Control</h2>
          <p className="mt-0.5 text-sm text-gray-400">
            Manage the lifecycle status of your event.
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-6 space-y-6 max-w-lg">
          {/* Current Status Card */}
          <div className="rounded-lg bg-gray-800 border border-gray-700 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                Current Status
              </span>
              <span
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${config.badge}`}
              >
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${config.dot} ${
                    config.pulse ? "animate-pulse" : ""
                  }`}
                />
                {config.label}
              </span>
            </div>

            <p className="text-sm text-gray-300 leading-relaxed">
              {config.description}
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="rounded-md bg-red-900/30 border border-red-700 px-4 py-3">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Transition actions */}
          {(config.forward || config.backward) && (
            <div className="space-y-3">
              {/* Primary forward action */}
              {config.forward && (
                <div className="rounded-lg bg-gray-800 border border-gray-700 p-5 space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {config.forward.label}
                    </h3>
                    <p className="mt-1 text-xs text-gray-400">
                      {getForwardDescription(event.status)}
                    </p>
                  </div>
                  <TransitionButton
                    transition={config.forward}
                    loading={loading}
                    onClick={handleTransitionRequest}
                  />
                </div>
              )}

              {/* Secondary backward action */}
              {config.backward && (
                <div className="rounded-lg bg-gray-800/50 border border-gray-700/50 p-5 space-y-3">
                  <div>
                    <h3 className="text-sm font-medium text-gray-300">
                      {config.backward.label}
                    </h3>
                    <p className="mt-1 text-xs text-gray-500">
                      {getBackwardDescription(event.status)}
                    </p>
                  </div>
                  <TransitionButton
                    transition={config.backward}
                    loading={loading}
                    onClick={handleTransitionRequest}
                  />
                </div>
              )}
            </div>
          )}

          {/* Ended state — no further transitions */}
          {event.status === "ended" && (
            <div className="rounded-lg bg-gray-800/50 border border-gray-700/50 p-5 text-center">
              <p className="text-sm text-gray-500">
                No further status changes are available for this event.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ===== Helpers =====

function getForwardDescription(status: EventStatus): string {
  switch (status) {
    case "draft":
      return "Opens audience join links so attendees can enter before the show begins.";
    case "active":
      return "Starts the live broadcast. Audience members will see your stage immediately.";
    case "live":
      return "Ends the broadcast and disconnects all audience members. This cannot be undone.";
    default:
      return "";
  }
}

function getBackwardDescription(status: EventStatus): string {
  switch (status) {
    case "active":
      return "Returns the event to draft and closes audience join links. Use this if the event went active by mistake.";
    case "live":
      return "Returns the event to ready status without ending it. Use this if the live status was triggered in error.";
    default:
      return "";
  }
}

// ===== TransitionButton =====

interface TransitionButtonProps {
  transition: Transition;
  loading: boolean;
  onClick: (transition: Transition) => void;
}

function TransitionButton({
  transition,
  loading,
  onClick,
}: TransitionButtonProps) {
  const baseClasses =
    "w-full rounded-md px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  const variantClasses: Record<Transition["variant"], string> = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800",
    secondary: "bg-gray-700 text-gray-200 hover:bg-gray-600 active:bg-gray-500",
    danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[transition.variant]}`}
      disabled={loading}
      onClick={() => onClick(transition)}
    >
      {loading ? "Updating…" : transition.label}
    </button>
  );
}
