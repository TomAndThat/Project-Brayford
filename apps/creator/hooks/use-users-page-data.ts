"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/shared/Toast";
import {
  getUserOrganizations,
  getOrganization,
  getOrganizationMembersWithUsers,
  getOrganizationBrands,
  getOrganizationPendingInvitations,
  type OrganizationMemberWithUser,
} from "@brayford/firebase-utils";
import {
  toBranded,
  fromBranded,
  hasPermission,
  USERS_VIEW,
  USERS_INVITE,
  USERS_UPDATE_ROLE,
  USERS_REMOVE,
  type UserId,
  type OrganizationDocument,
  type OrganizationMemberDocument,
  type BrandDocument,
  type InvitationDocument,
} from "@brayford/core";

export interface UseUsersPageDataReturn {
  /** Firebase user. */
  user: ReturnType<typeof useAuth>["user"];
  /** True while auth or data is still loading. */
  loading: boolean;
  /** The loaded organisation document. */
  organization: OrganizationDocument | null;
  /** The current user's membership record. */
  currentMember: OrganizationMemberDocument | null;
  /** Organisation members with user profiles. */
  members: OrganizationMemberWithUser[];
  /** Organisation brands. */
  brands: BrandDocument[];
  /** Pending invitations. */
  pendingInvitations: InvitationDocument[];
  /** Permission flags. */
  canInvite: boolean;
  canUpdateRoles: boolean;
  canRemove: boolean;
  /** Re-fetch all data. */
  reload: () => Promise<void>;
  /** Sign out and redirect to /signin. */
  handleSignOut: () => Promise<void>;
  /** Remove a member from the organisation. */
  handleRemoveUser: (member: OrganizationMemberWithUser) => Promise<void>;
}

/**
 * Data-loading hook for the users/team members page.
 *
 * Handles auth, org loading, members + brands + invitations fetching,
 * permission checks, and member-removal API call.
 */
export function useUsersPageData(): UseUsersPageDataReturn {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<OrganizationDocument | null>(
    null,
  );
  const [currentMember, setCurrentMember] =
    useState<OrganizationMemberDocument | null>(null);
  const [members, setMembers] = useState<OrganizationMemberWithUser[]>([]);
  const [brands, setBrands] = useState<BrandDocument[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<
    InvitationDocument[]
  >([]);

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
        const [orgMembers, orgBrands, orgInvitations] = await Promise.all([
          getOrganizationMembersWithUsers(orgId),
          getOrganizationBrands(orgId),
          getOrganizationPendingInvitations(orgId),
        ]);
        setMembers(orgMembers);
        setBrands(orgBrands);
        setPendingInvitations(orgInvitations);
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
      if (!hasPermission(currentMember, USERS_VIEW)) {
        showToast("You don't have permission to view team members.", {
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

  const handleRemoveUser = useCallback(
    async (memberToRemove: OrganizationMemberWithUser) => {
      if (!organization || !user) return;

      const userName =
        memberToRemove.user?.displayName ||
        memberToRemove.user?.email ||
        "this user";

      try {
        const idToken = await user.getIdToken();

        const response = await fetch(
          `/api/organizations/${fromBranded(organization.id)}/members/${fromBranded(memberToRemove.id)}`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
          },
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to remove user");
        }

        // Update local state
        setMembers((prev) => prev.filter((m) => m.id !== memberToRemove.id));

        showToast(`${userName} has been removed from the organisation`, {
          variant: "success",
        });
      } catch (error) {
        console.error("Error removing user:", error);
        showToast(
          error instanceof Error
            ? error.message
            : "Failed to remove user. Please try again.",
          { variant: "error" },
        );
      }
    },
    [organization, user, showToast],
  );

  const canInvite =
    currentMember != null && hasPermission(currentMember, USERS_INVITE);
  const canUpdateRoles =
    currentMember != null && hasPermission(currentMember, USERS_UPDATE_ROLE);
  const canRemove =
    currentMember != null && hasPermission(currentMember, USERS_REMOVE);

  return {
    user,
    loading: authLoading || loading,
    organization,
    currentMember,
    members,
    brands,
    pendingInvitations,
    canInvite,
    canUpdateRoles,
    canRemove,
    reload: loadUserData,
    handleSignOut,
    handleRemoveUser,
  };
}
