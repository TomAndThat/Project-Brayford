"use client";

import { useRouter } from "next/navigation";
import { useScenesPageData } from "@/hooks/use-scenes-page-data";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardLayoutWrapper from "@/components/dashboard/DashboardLayoutWrapper";
import SceneFilters from "@/components/scenes/SceneFilters";
import SceneGrid from "@/components/scenes/SceneGrid";

export default function ScenesPage() {
  const router = useRouter();
  const {
    user,
    loading,
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
  } = useScenesPageData();

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
          pageTitle="Scenes"
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header with create button */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Scenes</h2>
              <p className="text-sm text-gray-600 mt-1">
                Build and manage screen layouts for your live events
              </p>
            </div>
            <button
              onClick={() => router.push("/dashboard/scenes/new")}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create Scene
            </button>
          </div>

          {/* Filters */}
          <SceneFilters
            scopeFilter={scopeFilter}
            onScopeChange={setScopeFilter}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            brands={brands}
            events={events}
          />

          {/* Scene Grid */}
          <SceneGrid
            scenes={filteredScenes}
            brands={brands}
            events={events}
            hasFilters={!!(searchQuery || scopeFilter !== "all")}
            onSceneClick={(id) => router.push(`/dashboard/scenes/${id}`)}
            onCreateScene={() => router.push("/dashboard/scenes/new")}
          />
        </main>
      </div>
    </DashboardLayoutWrapper>
  );
}
