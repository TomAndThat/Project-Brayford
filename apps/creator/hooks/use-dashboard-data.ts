"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  getUserOrganizations,
  getOrganization,
  getOrganizationBrands,
  getOrganizationEvents,
} from "@brayford/firebase-utils";
import {
  toBranded,
  type UserId,
  type OrganizationId,
  type OrganizationDocument,
  type OrganizationMemberDocument,
  type BrandDocument,
  type EventDocument,
} from "@brayford/core";
import type { OrgSwitcherItem } from "@/components/dashboard/OrgSwitcher";

/** Local storage key for persisting the selected org. */
const SELECTED_ORG_KEY = "brayford:selected-org-id";

export interface UseDashboardDataReturn {
  /** Firebase user. */
  user: ReturnType<typeof useAuth>["user"];
  /** True while auth or data is still loading. */
  loading: boolean;
  /** The current organisation document. */
  organization: OrganizationDocument | null;
  /** Organisation brands. */
  brands: BrandDocument[];
  /** Organisation events. */
  events: EventDocument[];
  /** All organisations the user belongs to (for switcher). */
  allOrgs: OrgSwitcherItem[];
  /** The current user's membership record. */
  currentMember: OrganizationMemberDocument | null;
  /** Sandbox loading state. */
  sandboxLoading: boolean;
  /** Sandbox error message. */
  sandboxError: string | null;
  /** Switch to a different organisation. */
  handleOrgChange: (orgId: OrganizationId) => Promise<void>;
  /** Sign out and redirect to /signin. */
  handleSignOut: () => Promise<void>;
  /** Open the sandbox/test event. */
  handleOpenSandbox: () => Promise<void>;
}

/**
 * Data-loading hook for the main dashboard page.
 *
 * Handles auth, multi-org resolution + localStorage persistence,
 * brands/events loading, soft-delete filtering, and sandbox API call.
 */
export function useDashboardData(): UseDashboardDataReturn {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<OrganizationDocument | null>(
    null,
  );
  const [brands, setBrands] = useState<BrandDocument[]>([]);
  const [events, setEvents] = useState<EventDocument[]>([]);
  const [allOrgs, setAllOrgs] = useState<OrgSwitcherItem[]>([]);
  const [memberships, setMemberships] = useState<OrganizationMemberDocument[]>(
    [],
  );
  const [currentMember, setCurrentMember] =
    useState<OrganizationMemberDocument | null>(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [sandboxError, setSandboxError] = useState<string | null>(null);

  const loadOrgData = useCallback(
    async (orgId: OrganizationId) => {
      const org = await getOrganization(orgId);

      // Check if organisation is soft-deleted
      if (org?.softDeletedAt) {
        if (typeof window !== "undefined") {
          localStorage.removeItem(SELECTED_ORG_KEY);
        }
        router.push("/onboarding");
        return;
      }

      if (org) {
        setOrganization(org);
        const orgBrands = await getOrganizationBrands(orgId);
        setBrands(orgBrands);
        const orgEvents = await getOrganizationEvents(orgId);
        setEvents(orgEvents);
        if (typeof window !== "undefined") {
          localStorage.setItem(SELECTED_ORG_KEY, orgId as string);
        }
      }
    },
    [router],
  );

  const loadUserData = useCallback(async () => {
    if (!user) return;

    try {
      const userId = toBranded<UserId>(user.uid);
      const userMemberships = await getUserOrganizations(userId);

      if (userMemberships.length === 0) {
        router.push("/onboarding");
        return;
      }

      setMemberships(userMemberships);

      // Load org names for the switcher — filter out soft-deleted orgs
      const orgItemsWithNulls = await Promise.all(
        userMemberships.map(async (m) => {
          const org = await getOrganization(m.organizationId);
          if (org?.softDeletedAt) return null;
          return {
            id: m.organizationId,
            name: org?.name ?? "Unknown",
            role: m.role,
          } as OrgSwitcherItem;
        }),
      );
      const orgItems = orgItemsWithNulls.filter(
        (item): item is OrgSwitcherItem => item !== null,
      );

      if (orgItems.length === 0) {
        router.push("/onboarding");
        return;
      }

      setAllOrgs(orgItems);

      // Determine which org to show (persisted selection → first active)
      const savedOrgId =
        typeof window !== "undefined"
          ? localStorage.getItem(SELECTED_ORG_KEY)
          : null;
      const savedMembership = savedOrgId
        ? userMemberships.find(
            (m) => (m.organizationId as string) === savedOrgId,
          )
        : null;

      let targetMembership = savedMembership;
      if (targetMembership) {
        const savedOrg = await getOrganization(targetMembership.organizationId);
        if (savedOrg?.softDeletedAt) {
          targetMembership = null;
        }
      }

      if (!targetMembership) {
        const firstActiveOrgId = orgItems[0]?.id;
        targetMembership =
          userMemberships.find((m) => m.organizationId === firstActiveOrgId) ||
          userMemberships[0]!;
      }

      setCurrentMember(targetMembership);
      await loadOrgData(targetMembership.organizationId);
    } catch (error) {
      console.error("Error loading user data:", error);
    } finally {
      setLoading(false);
    }
  }, [user, router, loadOrgData]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/signin");
      return;
    }

    if (user) {
      loadUserData();
    }
  }, [user, authLoading, router, loadUserData]);

  const handleOrgChange = useCallback(
    async (orgId: OrganizationId) => {
      setLoading(true);
      const membership = memberships.find((m) => m.organizationId === orgId);
      if (membership) {
        setCurrentMember(membership);
      }
      await loadOrgData(orgId);
      setLoading(false);
    },
    [memberships, loadOrgData],
  );

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.push("/signin");
  }, [signOut, router]);

  const handleOpenSandbox = useCallback(async () => {
    if (!organization || !user) return;
    setSandboxLoading(true);
    setSandboxError(null);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/sandbox/open", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ organizationId: organization.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        setSandboxError(data.error ?? "Failed to open test event");
        return;
      }
      router.push(`/studio/${data.eventId}`);
    } catch {
      setSandboxError("Failed to open test event. Please try again.");
    } finally {
      setSandboxLoading(false);
    }
  }, [organization, user, router]);

  return {
    user,
    loading: authLoading || loading,
    organization,
    brands,
    events,
    allOrgs,
    currentMember,
    sandboxLoading,
    sandboxError,
    handleOrgChange,
    handleSignOut,
    handleOpenSandbox,
  };
}
