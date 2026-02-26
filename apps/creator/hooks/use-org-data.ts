"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/shared/Toast";
import {
  getUserOrganizations,
  getOrganization,
} from "@brayford/firebase-utils";
import {
  toBranded,
  type UserId,
  type OrganizationDocument,
  type OrganizationMemberDocument,
} from "@brayford/core";

export interface UseOrgDataReturn {
  /** Firebase user (null while loading / not authenticated). */
  user: ReturnType<typeof useAuth>["user"];
  /** True while auth or org data is still loading. */
  loading: boolean;
  /** The loaded organisation document. */
  organization: OrganizationDocument | null;
  /** The current user's membership record. */
  currentMember: OrganizationMemberDocument | null;
  /** Re-fetch org data (e.g. after an update). */
  reload: () => Promise<void>;
  /** Sign the user out and redirect to /signin. */
  handleSignOut: () => Promise<void>;
}

/**
 * Shared hook for loading the current user's organisation and membership.
 *
 * Handles common redirects:
 * - Not authenticated → /signin
 * - No organisations → /onboarding
 * - Organisation not found → /dashboard
 */
export function useOrgData(): UseOrgDataReturn {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<OrganizationDocument | null>(
    null,
  );
  const [currentMember, setCurrentMember] =
    useState<OrganizationMemberDocument | null>(null);

  const loadOrgData = useCallback(async () => {
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
        showToast("Organisation not found", { variant: "error" });
        router.push("/dashboard");
        return;
      }

      setOrganization(org);
    } catch (error) {
      console.error("Error loading organisation data:", error);
    } finally {
      setLoading(false);
    }
  }, [user, router, showToast]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/signin");
      return;
    }

    if (user) {
      loadOrgData();
    }
  }, [user, authLoading, router, loadOrgData]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.push("/signin");
  }, [signOut, router]);

  return {
    user,
    loading: authLoading || loading,
    organization,
    currentMember,
    reload: loadOrgData,
    handleSignOut,
  };
}
