"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  getUserOrganizations,
  getOrganization,
} from "@brayford/firebase-utils";
import {
  toBranded,
  type UserId,
  type OrganizationDocument,
  type OrganizationMemberDocument,
  hasPermission,
  IMAGES_VIEW,
} from "@brayford/core";
import { useToast } from "@/components/shared/Toast";
import { useImageLibrary } from "@/hooks/use-image-library";
import type { ImageLibraryItem } from "@/hooks/use-image-library";

export type SortOption = "date" | "name" | "size";

export interface UseImagesPageDataReturn {
  user: ReturnType<typeof useAuth>["user"];
  loading: boolean;
  organization: OrganizationDocument | null;
  currentMember: OrganizationMemberDocument | null;
  images: ImageLibraryItem[];
  imagesLoading: boolean;
  imagesError: string | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  tagFilter: string;
  setTagFilter: (t: string) => void;
  sortBy: SortOption;
  setSortBy: (s: SortOption) => void;
  allTags: string[];
  filteredImages: ImageLibraryItem[];
  handleSignOut: () => Promise<void>;
}

export function useImagesPageData(): UseImagesPageDataReturn {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<OrganizationDocument | null>(
    null,
  );
  const [currentMember, setCurrentMember] =
    useState<OrganizationMemberDocument | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date");

  const orgId = organization?.id ? (organization.id as string) : null;
  const {
    images,
    loading: imagesLoading,
    error: imagesError,
  } = useImageLibrary(orgId);

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

      const org = await getOrganization(currentMembership.organizationId);
      if (!org) {
        router.push("/dashboard");
        return;
      }
      setOrganization(org);
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
      if (!hasPermission(currentMember, IMAGES_VIEW)) {
        showToast("You don't have permission to view images.", {
          variant: "error",
        });
        router.push("/dashboard");
      }
    }
  }, [loading, currentMember, organization, router]);

  // Collect all unique tags for autocomplete
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    images.forEach((img) => img.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [images]);

  // Filter + sort images
  const filteredImages = useMemo(() => {
    let filtered = images;

    if (tagFilter) {
      const tagLower = tagFilter.toLowerCase();
      filtered = filtered.filter((img) =>
        img.tags.some((t) => t.toLowerCase() === tagLower),
      );
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (img) =>
          img.name.toLowerCase().includes(query) ||
          img.description.toLowerCase().includes(query),
      );
    }

    const sorted = [...filtered];
    switch (sortBy) {
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "size":
        sorted.sort((a, b) => b.sizeBytes - a.sizeBytes);
        break;
      case "date":
      default:
        break;
    }

    return sorted;
  }, [images, tagFilter, searchQuery, sortBy]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/signin");
  };

  return {
    user,
    loading: authLoading || loading,
    organization,
    currentMember,
    images,
    imagesLoading,
    imagesError,
    searchQuery,
    setSearchQuery,
    tagFilter,
    setTagFilter,
    sortBy,
    setSortBy,
    allTags,
    filteredImages,
    handleSignOut,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
