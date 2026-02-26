"use client";

import { useState, useCallback, useEffect } from "react";
import { useToast } from "@/components/shared/Toast";
import { auth } from "@brayford/firebase-utils";
import type { EventDocument } from "@brayford/core";

export interface EventFormValues {
  name: string;
  venue: string;
  scheduledDate: string;
  scheduledStartTime: string;
  scheduledEndDate: string;
  scheduledEndTime: string;
  parentEventId: string;
  maxAttendees: string;
  status: "draft" | "active" | "live" | "ended";
}

export interface UseEventFormReturn {
  /** Form field values. */
  values: EventFormValues;
  /** Update a single field. */
  setField: <K extends keyof EventFormValues>(
    key: K,
    value: EventFormValues[K],
  ) => void;
  /** Whether the form is currently submitting. */
  isSubmitting: boolean;
  /** Handle form submission. */
  handleSubmit: (e: React.FormEvent) => Promise<void>;
}

/**
 * Manages form state, validation, and submission for the event settings page.
 */
export function useEventForm(
  event: EventDocument | null,
  eventId: string,
  reload: () => Promise<void>,
): UseEventFormReturn {
  const { showToast } = useToast();

  const [values, setValues] = useState<EventFormValues>({
    name: "",
    venue: "",
    scheduledDate: "",
    scheduledStartTime: "",
    scheduledEndDate: "",
    scheduledEndTime: "",
    parentEventId: "",
    maxAttendees: "",
    status: "draft",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync form values when event data loads
  useEffect(() => {
    if (!event) return;

    setValues({
      name: event.name,
      venue: event.venue || "",
      scheduledDate: event.scheduledDate.toISOString().split("T")[0]!,
      scheduledStartTime: event.scheduledStartTime,
      scheduledEndDate: event.scheduledEndDate
        ? event.scheduledEndDate.toISOString().split("T")[0]!
        : "",
      scheduledEndTime: event.scheduledEndTime || "",
      parentEventId: event.parentEventId || "",
      maxAttendees: event.maxAttendees ? String(event.maxAttendees) : "",
      status: event.status,
    });
  }, [event]);

  const setField = useCallback(
    <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) => {
      setValues((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Validate
      const trimmedName = values.name.trim();
      if (!trimmedName) {
        showToast("Event name is required", { variant: "error" });
        return;
      }

      const trimmedVenue = values.venue.trim();
      if (trimmedVenue && trimmedVenue.length > 200) {
        showToast("Venue must be 200 characters or less", {
          variant: "error",
        });
        return;
      }

      if (!values.scheduledDate || !values.scheduledStartTime) {
        showToast("Date and start time are required", { variant: "error" });
        return;
      }

      if (values.scheduledEndTime && !values.scheduledEndDate) {
        showToast("End date is required when end time is specified", {
          variant: "error",
        });
        return;
      }

      setIsSubmitting(true);

      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error("Not authenticated");

        const updateData: Record<string, unknown> = {
          name: trimmedName,
          scheduledDate: values.scheduledDate,
          scheduledStartTime: values.scheduledStartTime,
          status: values.status,
        };

        if (trimmedVenue) {
          updateData.venue = trimmedVenue;
        }

        if (values.scheduledEndDate) {
          updateData.scheduledEndDate = values.scheduledEndDate;
        }

        if (values.scheduledEndTime) {
          updateData.scheduledEndTime = values.scheduledEndTime;
        }

        if (values.parentEventId) {
          updateData.parentEventId = values.parentEventId;
        } else if (event?.parentEventId) {
          updateData.parentEventId = null;
        }

        if (values.maxAttendees) {
          const attendeeCount = parseInt(values.maxAttendees, 10);
          if (attendeeCount > 0) {
            updateData.maxAttendees = attendeeCount;
          }
        } else if (event?.maxAttendees) {
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

        showToast("Event updated successfully", { variant: "success" });
        await reload();
      } catch (error) {
        console.error("Error updating event:", error);
        showToast(
          error instanceof Error
            ? error.message
            : "Failed to update event. Please try again.",
          { variant: "error" },
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, event, eventId, reload, showToast],
  );

  return {
    values,
    setField,
    isSubmitting,
    handleSubmit,
  };
}
