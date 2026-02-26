"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useImagesPageData } from "@/hooks/use-images-page-data";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardLayoutWrapper from "@/components/dashboard/DashboardLayoutWrapper";
import ImageFilters from "@/components/images/ImageFilters";
import ImageGrid from "@/components/images/ImageGrid";
import ImageUploadModal from "@/components/images/ImageUploadModal";

export default function ImagesPage() {
  const router = useRouter();
  const {
    user,
    loading,
    organization,
    currentMember,
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
  } = useImagesPageData();

  const [showUploadModal, setShowUploadModal] = useState(false);

  // ── Loading / guard states ──────────────────────────────────────────
  if (loading) {
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
          <ImageFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            tagFilter={tagFilter}
            onTagFilterChange={setTagFilter}
            sortBy={sortBy}
            onSortChange={setSortBy}
            allTags={allTags}
          />

          {/* Image Grid (handles error, loading, empty, and populated states) */}
          <ImageGrid
            images={filteredImages}
            isLoading={imagesLoading}
            error={imagesError}
            hasFilters={!!(searchQuery || tagFilter)}
            onImageClick={(id) => router.push(`/dashboard/images/${id}`)}
            onUpload={() => setShowUploadModal(true)}
          />
        </main>
      </div>

      {/* Upload Modal */}
      {showUploadModal && organization && (
        <ImageUploadModal
          organizationId={organization.id as string}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false);
          }}
        />
      )}
    </DashboardLayoutWrapper>
  );
}
