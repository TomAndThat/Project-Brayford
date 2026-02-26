"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useBrandsPageData, filterBrands } from "@/hooks/use-brands-page-data";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import CreateBrandModal from "@/components/brands/CreateBrandModal";
import BrandsFilterTabs from "@/components/brands/BrandsFilterTabs";
import BrandsTable from "@/components/brands/BrandsTable";

export default function BrandsPage() {
  const router = useRouter();
  const {
    user,
    loading,
    organization,
    currentMember,
    brands,
    filter,
    setFilter,
    canCreate,
    canUpdate,
    restoringBrandId,
    handleSignOut,
    handleRestoreBrand,
  } = useBrandsPageData();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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

  const filteredBrands = filterBrands(brands, currentMember, filter);

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        user={user}
        organizationName={organization.name}
        onSignOut={handleSignOut}
        currentMember={currentMember}
        pageTitle="Brands"
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Header with Create Button */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Brands</h2>
            <p className="text-gray-600 mt-1">
              Manage your organisation&apos;s brands
            </p>
          </div>
          {canCreate && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              data-testid="create-brand-btn"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
              Create Brand
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        {brands.length > 0 && (
          <BrandsFilterTabs
            brands={brands}
            filter={filter}
            onFilterChange={setFilter}
          />
        )}

        {/* Brands Table */}
        <BrandsTable
          filteredBrands={filteredBrands}
          allBrands={brands}
          canCreate={canCreate}
          canUpdate={canUpdate}
          restoringBrandId={restoringBrandId}
          filterLabel={filter}
          onCreateBrand={() => setIsCreateModalOpen(true)}
          onRestoreBrand={handleRestoreBrand}
        />
      </main>

      {/* Create Brand Modal */}
      <CreateBrandModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        organizationId={organization.id}
        organizationName={organization.name}
        onSuccess={(brandId) => router.push(`/dashboard/brands/${brandId}`)}
      />
    </div>
  );
}
