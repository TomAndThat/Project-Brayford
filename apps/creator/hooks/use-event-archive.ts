"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/shared/Toast";
import { auth } from "@brayford/firebase-utils";

export interface UseEventArchiveReturn {
  showArchiveDialog: boolean;
  setShowArchiveDialog: (open: boolean) => void;
  isArchiving: boolean;
  handleArchive: () => Promise<void>;
  showUnarchiveDialog: boolean;
  setShowUnarchiveDialog: (open: boolean) => void;
  isUnarchiving: boolean;
  handleUnarchive: () => Promise<void>;
}

/**
 * Manages archive/unarchive state and API calls for an event.
 */
export function useEventArchive(
  eventId: string,
  reload: () => Promise<void>,
): UseEventArchiveReturn {
  const router = useRouter();
  const { showToast } = useToast();

  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [showUnarchiveDialog, setShowUnarchiveDialog] = useState(false);
  const [isUnarchiving, setIsUnarchiving] = useState(false);

  const handleArchive = useCallback(async () => {
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

      router.push("/dashboard/events");
    } catch (error) {
      console.error("Error archiving event:", error);
      showToast(
        error instanceof Error
          ? error.message
          : "Failed to archive event. Please try again.",
        { variant: "error" },
      );
    } finally {
      setIsArchiving(false);
      setShowArchiveDialog(false);
    }
  }, [eventId, router, showToast]);

  const handleUnarchive = useCallback(async () => {
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

      showToast("Event unarchived successfully", { variant: "success" });
      await reload();
    } catch (error) {
      console.error("Error unarchiving event:", error);
      showToast(
        error instanceof Error
          ? error.message
          : "Failed to unarchive event. Please try again.",
        { variant: "error" },
      );
    } finally {
      setIsUnarchiving(false);
      setShowUnarchiveDialog(false);
    }
  }, [eventId, reload, showToast]);

  return {
    showArchiveDialog,
    setShowArchiveDialog,
    isArchiving,
    handleArchive,
    showUnarchiveDialog,
    setShowUnarchiveDialog,
    isUnarchiving,
    handleUnarchive,
  };
}
