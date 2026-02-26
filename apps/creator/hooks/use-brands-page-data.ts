"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/shared/Toast";
import {
  getUserOrganizations,
  getOrganization,
  getOrganizationBrands,
  auth,
} from "@brayford/firebase-utils";
import {
  toBranded,
  fromBranded,
  hasPermission,
  hasBrandAccess,
  BRANDS_VIEW,
  BRANDS_CREATE,
  BRANDS_UPDATE,
  type UserId,
  type OrganizationDocument,
  type OrganizationMemberDocument,
  type BrandDocument,
  type BrandId,
} from "@brayford/core";

export type BrandFilter = "active" | "archived" | "all";

export interface UseBrandsPageDataReturn {
  user: ReturnType<typeof useAuth>["user"];
  loading: boolean;
  organization: OrganizationDocument | null;
  currentMember: OrganizationMemberDocument | null;
  brands: BrandDocument[];
  filter: BrandFilter;
  setFilter: (filter: BrandFilter) => void;
  canCreate: boolean;
  canUpdate: boolean;
  restoringBrandId: string | null;
  reload: () => Promise<void>;
  handleSignOut: () => Promise<void>;
  handleRestoreBrand: (brandId: BrandId) => Promise<void>;
}

/**
 * Data-loading hook for the brands list page.
 */
export function useBrandsPageData(): UseBrandsPageDataReturn {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<OrganizationDocument | null>(
    null,
  );
  const [currentMember, setCurrentMember] =
    useState<OrganizationMemberDocument | null>(null);
  const [brands, setBrands] = useState<BrandDocument[]>([]);
  const [filter, setFilter] = useState<BrandFilter>("active");
  const [restoringBrandId, setRestoringBrandId] = useState<string | null>(null);

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
        const orgBrands = await getOrganizationBrands(orgId, false);
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

  useEffect(() => {
    if (!loading && currentMember && organization) {
      if (!hasPermission(currentMember, BRANDS_VIEW)) {
        showToast("You don't have permission to view brands.", {
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

  const handleRestoreBrand = useCallback(
    async (brandId: BrandId) => {
      setRestoringBrandId(fromBranded(brandId));

      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error("Not authenticated");

        const response = await fetch(`/api/brands/${fromBranded(brandId)}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ isActive: true }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to restore brand");
        }

        await loadUserData();
        showToast("Brand restored successfully", { variant: "success" });
      } catch (err) {
        console.error("Error restoring brand:", err);
        showToast(
          err instanceof Error ? err.message : "Failed to restore brand",
          { variant: "error" },
        );
      } finally {
        setRestoringBrandId(null);
      }
    },
    [loadUserData, showToast],
  );

  const canCreate =
    currentMember != null && hasPermission(currentMember, BRANDS_CREATE);
  const canUpdate =
    currentMember != null && hasPermission(currentMember, BRANDS_UPDATE);

  return {
    user,
    loading: authLoading || loading,
    organization,
    currentMember,
    brands,
    filter,
    setFilter,
    canCreate,
    canUpdate,
    restoringBrandId,
    reload: loadUserData,
    handleSignOut,
    handleRestoreBrand,
  };
}

/** Filter brands by access + active/archived state. */
export function filterBrands(
  brands: BrandDocument[],
  currentMember: OrganizationMemberDocument,
  filter: BrandFilter,
): BrandDocument[] {
  return brands.filter((brand) => {
    if (!hasBrandAccess(currentMember, brand.id)) return false;
    if (filter === "active") return brand.isActive;
    if (filter === "archived") return !brand.isActive;
    return true;
  });
}
