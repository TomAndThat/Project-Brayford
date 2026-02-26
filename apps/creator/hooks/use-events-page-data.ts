"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/shared/Toast";
import {
  getUserOrganizations,
  getOrganization,
  getOrganizationEvents,
  getOrganizationBrands,
} from "@brayford/firebase-utils";
import {
  toBranded,
  fromBranded,
  hasPermission,
  EVENTS_VIEW,
  EVENTS_CREATE,
  type UserId,
  type OrganizationDocument,
  type OrganizationMemberDocument,
  type EventDocument,
  type BrandDocument,
} from "@brayford/core";

export type EventFilter =
  | "active"
  | "archived"
  | "all"
  | "groups"
  | "standalone"
  | "children";

export interface UseEventsPageDataReturn {
  /** Firebase user (null while loading / not authenticated). */
  user: ReturnType<typeof useAuth>["user"];
  /** True while auth or data is still loading. */
  loading: boolean;
  /** The loaded organisation document. */
  organization: OrganizationDocument | null;
  /** The current user's membership record. */
  currentMember: OrganizationMemberDocument | null;
  /** All events (including archived). */
  events: EventDocument[];
  /** All active brands. */
  brands: BrandDocument[];
  /** Current filter selection. */
  filter: EventFilter;
  /** Set the current filter. */
  setFilter: (filter: EventFilter) => void;
  /** Whether the user can create events. */
  canCreate: boolean;
  /** Re-fetch data (e.g. after creating an event). */
  reload: () => Promise<void>;
  /** Sign the user out and redirect to /signin. */
  handleSignOut: () => Promise<void>;
}

/**
 * Data-loading hook for the events list page.
 *
 * Handles auth, org loading, events + brands fetching, permission
 * checks, and filter state.
 */
export function useEventsPageData(): UseEventsPageDataReturn {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<OrganizationDocument | null>(
    null,
  );
  const [currentMember, setCurrentMember] =
    useState<OrganizationMemberDocument | null>(null);
  const [events, setEvents] = useState<EventDocument[]>([]);
  const [brands, setBrands] = useState<BrandDocument[]>([]);
  const [filter, setFilter] = useState<EventFilter>("active");

  const loadUserData = useCallback(async () => {
    if (!user) return;

    try {
      const userId = toBranded<UserId>(user.uid);
      const memberships = await getUserOrganizations(userId);

      if (memberships.length === 0) {
        router.push("/onboarding");
        return;
      }

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
        showToast("You don't have permission to view events.", {
          variant: "error",
        });
        router.push("/dashboard");
      }
    }
  }, [loading, currentMember, organization, router, showToast]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.push("/signin");
  }, [signOut, router]);

  const canCreate =
    currentMember != null && hasPermission(currentMember, EVENTS_CREATE);

  return {
    user,
    loading: authLoading || loading,
    organization,
    currentMember,
    events,
    brands,
    filter,
    setFilter,
    canCreate,
    reload: loadUserData,
    handleSignOut,
  };
}

// ── Utility helpers used by the events list UI ────────────────────────

/** Get brand name by brand ID. */
export function getBrandName(
  brands: BrandDocument[],
  brandId: string,
): string {
  const brand = brands.find((b) => fromBranded(b.id) === brandId);
  return brand?.name || "Unknown Brand";
}

/** Format a Date for display (en-GB). */
export function formatEventDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Get CSS classes for a status badge. */
export function getStatusColor(status: string): string {
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
}

/** Check if event is an event group. */
export function isEventGroup(event: EventDocument): boolean {
  return event.eventType === "group";
}

/** Count child events for a given parent event ID. */
export function getChildEventCount(
  events: EventDocument[],
  eventId: string,
): number {
  return events.filter(
    (e) =>
      e.eventType === "event" &&
      e.parentEventId &&
      fromBranded(e.parentEventId as any) === eventId,
  ).length;
}

/** Filter events based on the selected filter tab. */
export function filterEvents(
  events: EventDocument[],
  filter: EventFilter,
): EventDocument[] {
  switch (filter) {
    case "active":
      return events.filter((e) => e.isActive);
    case "archived":
      return events.filter((e) => !e.isActive);
    case "groups":
      return events.filter((e) => e.isActive && isEventGroup(e));
    case "standalone":
      return events.filter(
        (e) => e.isActive && e.eventType === "event" && !e.parentEventId,
      );
    case "children":
      return events.filter(
        (e) => e.isActive && e.eventType === "event" && !!e.parentEventId,
      );
    case "all":
    default:
      return events;
  }
}
