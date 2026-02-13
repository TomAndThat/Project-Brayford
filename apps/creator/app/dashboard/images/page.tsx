"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  getUserOrganizations,
  getOrganization,
  auth,
} from "@brayford/firebase-utils";
import {
  toBranded,
  type UserId,
  type OrganizationDocument,
  type OrganizationMemberDocument,
  hasPermission,
  IMAGES_VIEW,
} from "@brayford/core";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardLayoutWrapper from "@/components/dashboard/DashboardLayoutWrapper";
import { useImageLibrary } from "@/hooks/use-image-library";
import type { ImageLibraryItem } from "@/hooks/use-image-library";
import ImageUploadModal from "@/components/images/ImageUploadModal";

type SortOption = "date" | "name" | "size";

export default function ImagesPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<OrganizationDocument | null>(
    null,
  );
  const [currentMember, setCurrentMember] =
    useState<OrganizationMemberDocument | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [showUploadModal, setShowUploadModal] = useState(false);

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
        router.push("/dashboard");
      }
    }
  }, [loading, currentMember, organization, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/signin");
  };

  // Collect all unique tags for autocomplete
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    images.forEach((img) => img.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [images]);

  // Filter + sort images
  const filteredImages = useMemo(() => {
    let filtered = images;

    // Tag filter
    if (tagFilter) {
      const tagLower = tagFilter.toLowerCase();
      filtered = filtered.filter((img) =>
        img.tags.some((t) => t.toLowerCase() === tagLower),
      );
    }

    // Search by name
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (img) =>
          img.name.toLowerCase().includes(query) ||
          img.description.toLowerCase().includes(query),
      );
    }

    // Sort
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
        // Already sorted desc by createdAt from the hook
        break;
    }

    return sorted;
  }, [images, tagFilter, searchQuery, sortBy]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user || !organization || !currentMember) {
    return null;
  }

  return (
    <DashboardLayoutWrapper organizationName={organization.name}>
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader
          user={user}
          organizationName={organization.name}
          onSignOut={handleSignOut}
          currentMember={currentMember}
          pageTitle="Images"
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header with upload button */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Image Library
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Manage your organisation&apos;s images and assets
              </p>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              Upload Image
            </button>
          </div>

          {/* Filters */}
          <div className="mb-6 bg-white rounded-lg shadow-sm p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Search */}
              <div>
                <label
                  htmlFor="search"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Search
                </label>
                <input
                  type="text"
                  id="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name..."
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                />
              </div>

              {/* Tag filter */}
              <div>
                <label
                  htmlFor="tag-filter"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Filter by Tag
                </label>
                <select
                  id="tag-filter"
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="">All Tags</option>
                  {allTags.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort */}
              <div>
                <label
                  htmlFor="sort-by"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Sort By
                </label>
                <select
                  id="sort-by"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="date">Date Uploaded</option>
                  <option value="name">Name</option>
                  <option value="size">File Size</option>
                </select>
              </div>
            </div>
          </div>

          {/* Error state */}
          {imagesError && (
            <div className="mb-6 p-4 rounded-md bg-red-50 text-red-800">
              <p className="text-sm font-medium">{imagesError}</p>
            </div>
          )}

          {/* Loading state */}
          {imagesLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-lg text-gray-600">Loading images...</div>
            </div>
          )}

          {/* Empty state */}
          {!imagesLoading && filteredImages.length === 0 && (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <svg
                className="w-16 h-16 text-gray-300 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {searchQuery || tagFilter ? "No images found" : "No images yet"}
              </h3>
              <p className="text-gray-600 max-w-md mx-auto">
                {searchQuery || tagFilter
                  ? "Try adjusting your filters or search query."
                  : "Upload your first image to start building your library."}
              </p>
              {!searchQuery && !tagFilter && (
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="mt-6 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Upload Your First Image
                </button>
              )}
            </div>
          )}

          {/* Image grid */}
          {!imagesLoading && filteredImages.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredImages.map((image) => (
                <div
                  key={image.id}
                  onClick={() => router.push(`/dashboard/images/${image.id}`)}
                  className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer overflow-hidden group"
                >
                  {/* Thumbnail */}
                  <div className="aspect-square bg-gray-100 relative overflow-hidden">
                    {image.url ? (
                      <img
                        src={image.url}
                        alt={image.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg
                          className="w-12 h-12 text-gray-300"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                      {image.name}
                    </h3>
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                      <span>
                        {image.dimensions.width} × {image.dimensions.height}
                      </span>
                      <span>·</span>
                      <span>{formatFileSize(image.sizeBytes)}</span>
                    </div>
                    {image.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {image.tags.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700"
                          >
                            {t}
                          </span>
                        ))}
                        {image.tags.length > 3 && (
                          <span className="text-xs text-gray-400">
                            +{image.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Upload Modal */}
      {showUploadModal && organization && (
        <ImageUploadModal
          organizationId={organization.id as string}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false);
            // Images will auto-update via the real-time subscription
          }}
        />
      )}
    </DashboardLayoutWrapper>
  );
}
