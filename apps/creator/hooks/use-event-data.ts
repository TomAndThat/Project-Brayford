"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/shared/Toast";
import {
  getUserOrganizations,
  getOrganization,
  getEvent,
  getBrand,
  getOrganizationEvents,
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
} from "@brayford/core";

export interface UseEventDataReturn {
  /** Firebase user (null while loading / not authenticated). */
  user: ReturnType<typeof useAuth>["user"];
  /** True while auth or event data is still loading. */
  loading: boolean;
  /** The loaded event document. */
  event: EventDocument | null;
  /** The brand associated with the event. */
  brand: BrandDocument | null;
  /** The organisation the event belongs to. */
  organization: OrganizationDocument | null;
  /** The current user's membership record. */
  currentMember: OrganizationMemberDocument | null;
  /** Event groups available for parent selection (excludes current event). */
  eventGroups: EventDocument[];
  /** Child events if this is an event group. */
  childEvents: EventDocument[];
  /** Re-fetch event data (e.g. after an update). */
  reload: () => Promise<void>;
  /** Sign the user out and redirect to /signin. */
  handleSignOut: () => Promise<void>;
}

/**
 * Loads auth state, organisation membership, and event data for
 * the event settings page. Handles redirects when:
 * - user is not authenticated → /signin
 * - user has no organisations → /onboarding
 * - org/event not found → /dashboard/events
 */
export function useEventData(eventId: string): UseEventDataReturn {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<EventDocument | null>(null);
  const [brand, setBrand] = useState<BrandDocument | null>(null);
  const [organization, setOrganization] = useState<OrganizationDocument | null>(
    null,
  );
  const [currentMember, setCurrentMember] =
    useState<OrganizationMemberDocument | null>(null);
  const [eventGroups, setEventGroups] = useState<EventDocument[]>([]);
  const [childEvents, setChildEvents] = useState<EventDocument[]>([]);

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
        showToast("Organisation not found", { variant: "error" });
        router.push("/dashboard");
        return;
      }

      setOrganization(org);

      // Load event
      const eventData = await getEvent(toBranded<EventId>(eventId));

      if (!eventData) {
        showToast("Event not found", { variant: "error" });
        router.push("/dashboard/events");
        return;
      }

      setEvent(eventData);

      // Load brand
      const brandData = await getBrand(eventData.brandId);
      if (brandData) {
        setBrand(brandData);
      }

      // Load all organization events for parent selection (only groups)
      const orgEvents = await getOrganizationEvents(orgId, true);
      setEventGroups(
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
      showToast("Failed to load event", { variant: "error" });
      router.push("/dashboard/events");
    } finally {
      setLoading(false);
    }
  }, [user, eventId, router, showToast]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/signin");
      return;
    }

    if (user) {
      loadEventData();
    }
  }, [user, authLoading, router, loadEventData]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.push("/signin");
  }, [signOut, router]);

  return {
    user,
    loading: authLoading || loading,
    event,
    brand,
    organization,
    currentMember,
    eventGroups,
    childEvents,
    reload: loadEventData,
    handleSignOut,
  };
}
