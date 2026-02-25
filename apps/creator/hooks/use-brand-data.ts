"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/shared/Toast";
import {
  getUserOrganizations,
  getBrand,
  getOrganization,
  auth,
} from "@brayford/firebase-utils";
import {
  toBranded,
  hasBrandAccess,
  type UserId,
  type BrandId,
  type BrandDocument,
  type OrganizationDocument,
  type OrganizationMemberDocument,
} from "@brayford/core";

export interface UseBrandDataReturn {
  /** Firebase user (null while loading / not authenticated). */
  user: ReturnType<typeof useAuth>["user"];
  /** True while auth or brand data is still loading. */
  loading: boolean;
  /** The loaded brand document. */
  brand: BrandDocument | null;
  /** The organisation the brand belongs to. */
  organization: OrganizationDocument | null;
  /** The current user's membership record. */
  currentMember: OrganizationMemberDocument | null;
  /** Re-fetch brand & org data (e.g. after an update). */
  reload: () => Promise<void>;
  /** Sign the user out and redirect to /signin. */
  handleSignOut: () => Promise<void>;
}

/**
 * Loads auth state, organisation membership, and brand document for
 * the brand settings page. Handles redirects when:
 * - user is not authenticated → /signin
 * - user has no organisations → /onboarding
 * - user lacks brand access → /dashboard/brands
 * - brand/org not found → /dashboard/brands
 */
export function useBrandData(brandId: string): UseBrandDataReturn {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState<BrandDocument | null>(null);
  const [organization, setOrganization] = useState<OrganizationDocument | null>(
    null,
  );
  const [currentMember, setCurrentMember] =
    useState<OrganizationMemberDocument | null>(null);

  const loadBrandData = useCallback(async () => {
    if (!user || !brandId) return;

    try {
      const userId = toBranded<UserId>(user.uid);
      const memberships = await getUserOrganizations(userId);

      if (memberships.length === 0) {
        router.push("/onboarding");
        return;
      }

      const currentMembership = memberships[0]!;
      setCurrentMember(currentMembership);

      // Verify user has access to this specific brand before loading
      if (!hasBrandAccess(currentMembership, toBranded<BrandId>(brandId))) {
        router.push("/dashboard/brands");
        return;
      }

      // Load organisation
      const orgId = currentMembership.organizationId;
      const org = await getOrganization(orgId);

      if (!org) {
        showToast("Organisation not found", { variant: "error" });
        router.push("/dashboard");
        return;
      }

      setOrganization(org);

      // Load brand
      const brandData = await getBrand(toBranded<BrandId>(brandId));

      if (!brandData) {
        showToast("Brand not found", { variant: "error" });
        router.push("/dashboard/brands");
        return;
      }

      setBrand(brandData);
    } catch (error) {
      console.error("Error loading brand data:", error);
      showToast("Failed to load brand", { variant: "error" });
      router.push("/dashboard/brands");
    } finally {
      setLoading(false);
    }
  }, [user, brandId, router, showToast]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/signin");
      return;
    }

    if (user) {
      loadBrandData();
    }
  }, [user, authLoading, router, loadBrandData]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.push("/signin");
  }, [signOut, router]);

  return {
    user,
    loading: authLoading || loading,
    brand,
    organization,
    currentMember,
    reload: loadBrandData,
    handleSignOut,
  };
}
