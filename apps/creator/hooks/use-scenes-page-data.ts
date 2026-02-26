"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  getUserOrganizations,
  getOrganization,
  getOrganizationBrands,
  getOrganizationEvents,
  auth,
} from "@brayford/firebase-utils";
import {
  toBranded,
  fromBranded,
  type UserId,
  type OrganizationDocument,
  type OrganizationMemberDocument,
  type BrandDocument,
  type EventDocument,
  type SceneDocument,
  hasPermission,
  EVENTS_MANAGE_MODULES,
} from "@brayford/core";
import { useToast } from "@/components/shared/Toast";

export type ScopeFilter = "all" | "org" | string; // "all", "org", "brand:{id}", "event:{id}"

export type SceneWithId = SceneDocument & { id: string };

export interface UseScenesPageDataReturn {
  user: ReturnType<typeof useAuth>["user"];
  loading: boolean;
  organization: OrganizationDocument | null;
  currentMember: OrganizationMemberDocument | null;
  brands: BrandDocument[];
  events: EventDocument[];
  filteredScenes: SceneWithId[];
  scopeFilter: ScopeFilter;
  setScopeFilter: (f: ScopeFilter) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  handleSignOut: () => Promise<void>;
}

export function useScenesPageData(): UseScenesPageDataReturn {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<OrganizationDocument | null>(
    null,
  );
  const [currentMember, setCurrentMember] =
    useState<OrganizationMemberDocument | null>(null);
  const [scenes, setScenes] = useState<SceneWithId[]>([]);
  const [brands, setBrands] = useState<BrandDocument[]>([]);
  const [events, setEvents] = useState<EventDocument[]>([]);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

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

      if (!org) {
        router.push("/dashboard");
        return;
      }

      setOrganization(org);

      // Load brands (excluding archived)
      const orgBrands = await getOrganizationBrands(orgId, true);
      setBrands(orgBrands);

      // Load events (excluding archived)
      const orgEvents = await getOrganizationEvents(orgId, true);
      setEvents(orgEvents);

      // Load scenes from API
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(
        `/api/scenes?organizationId=${fromBranded(orgId)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        setScenes(data.scenes || []);
      } else {
        console.error("Failed to load scenes");
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

  useEffect(() => {
    if (!loading && currentMember && organization) {
      if (!hasPermission(currentMember, EVENTS_MANAGE_MODULES)) {
        showToast("You don't have permission to manage scenes.", {
          variant: "error",
        });
        router.push("/dashboard");
      }
    }
  }, [loading, currentMember, organization, router]);

  // Filter and search scenes
  const filteredScenes = useMemo(() => {
    let filtered = scenes;

    // Apply scope filter with inheritance
    if (scopeFilter === "org") {
      filtered = filtered.filter(
        (s) => s.brandId === null && s.eventId === null,
      );
    } else if (scopeFilter.startsWith("brand:")) {
      const brandId = scopeFilter.slice(6);
      filtered = filtered.filter(
        (s) =>
          (s.brandId === null && s.eventId === null) ||
          (s.brandId !== null &&
            fromBranded(s.brandId) === brandId &&
            s.eventId === null),
      );
    } else if (scopeFilter.startsWith("event:")) {
      const eventId = scopeFilter.slice(6);
      const event = events.find((e) => fromBranded(e.id) === eventId);
      if (event) {
        const eventBrandId = fromBranded(event.brandId);
        filtered = filtered.filter(
          (s) =>
            (s.brandId === null && s.eventId === null) ||
            (s.brandId !== null &&
              fromBranded(s.brandId) === eventBrandId &&
              s.eventId === null) ||
            (s.eventId !== null && fromBranded(s.eventId) === eventId),
        );
      } else {
        filtered = filtered.filter(
          (s) => s.eventId !== null && fromBranded(s.eventId) === eventId,
        );
      }
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((s) => {
        const sceneName = s.name.toLowerCase();
        const sceneDesc = (s.description || "").toLowerCase();

        const brand = s.brandId
          ? brands.find((b) => fromBranded(b.id) === fromBranded(s.brandId!))
          : undefined;
        const event = s.eventId
          ? events.find((e) => fromBranded(e.id) === fromBranded(s.eventId!))
          : undefined;

        const brandName = brand?.name.toLowerCase() || "";
        const eventName = event?.name.toLowerCase() || "";

        return (
          sceneName.includes(query) ||
          sceneDesc.includes(query) ||
          brandName.includes(query) ||
          eventName.includes(query)
        );
      });
    }

    return filtered;
  }, [scenes, scopeFilter, searchQuery, brands, events]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/signin");
  };

  return {
    user,
    loading: authLoading || loading,
    organization,
    currentMember,
    brands,
    events,
    filteredScenes,
    scopeFilter,
    setScopeFilter,
    searchQuery,
    setSearchQuery,
    handleSignOut,
  };
}

/** Get a human-readable scope label for a scene. */
export function getScopeLabel(
  scene: SceneDocument,
  brands: BrandDocument[],
  events: EventDocument[],
): string {
  if (scene.eventId !== null) {
    const event = events.find(
      (e) => fromBranded(e.id) === fromBranded(scene.eventId!),
    );
    return event ? `Event: ${event.name}` : "Event";
  }
  if (scene.brandId !== null) {
    const brand = brands.find(
      (b) => fromBranded(b.id) === fromBranded(scene.brandId!),
    );
    return brand ? `Brand: ${brand.name}` : "Brand";
  }
  return "Organisation-wide";
}
