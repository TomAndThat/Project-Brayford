"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  getUserOrganizations,
  getOrganization,
  getOrganizationBrands,
} from "@brayford/firebase-utils";
import {
  toBranded,
  fromBranded,
  type UserId,
  type OrganizationDocument,
  type OrganizationMemberDocument,
  type BrandDocument,
  type BrandId,
  hasPermission,
  BRANDS_VIEW,
  BRANDS_CREATE,
  BRANDS_UPDATE,
} from "@brayford/core";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import CreateBrandModal from "@/components/brands/CreateBrandModal";
import { auth } from "@brayford/firebase-utils";

type BrandFilter = "active" | "archived" | "all";

export default function BrandsPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<OrganizationDocument | null>(
    null,
  );
  const [currentMember, setCurrentMember] =
    useState<OrganizationMemberDocument | null>(null);
  const [brands, setBrands] = useState<BrandDocument[]>([]);
  const [filter, setFilter] = useState<BrandFilter>("active");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [restoringBrandId, setRestoringBrandId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const loadUserData = useCallback(async () => {
    if (!user) return;

    try {
      const userId = toBranded<UserId>(user.uid);
      const memberships = await getUserOrganizations(userId);

      if (memberships.length === 0) {
        router.push("/onboarding");
        return;
      }

      // Get first organization and current member record
      const currentMembership = memberships[0]!;
      setCurrentMember(currentMembership);

      const orgId = currentMembership.organizationId;
      const org = await getOrganization(orgId);

      if (org) {
        setOrganization(org);
        // Load all brands (including archived) for filtering
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

  // Check permissions after data loads
  useEffect(() => {
    if (!loading && currentMember && organization) {
      if (!hasPermission(currentMember, BRANDS_VIEW)) {
        alert("You don't have permission to view brands.");
        router.push("/dashboard");
      }
    }
  }, [loading, currentMember, organization, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/signin");
  };

  const handleCreateBrand = () => {
    setIsCreateModalOpen(true);
  };

  const handleCreateSuccess = (brandId: string) => {
    // Redirect to brand settings page
    router.push(`/dashboard/brands/${brandId}`);
  };

  const handleRestoreBrand = async (brandId: BrandId) => {
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

      // Reload brands
      await loadUserData();

      setNotification({
        type: "success",
        message: "Brand restored successfully",
      });
      setTimeout(() => setNotification(null), 5000);
    } catch (err) {
      console.error("Error restoring brand:", err);
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to restore brand",
      });
      setTimeout(() => setNotification(null), 7000);
    } finally {
      setRestoringBrandId(null);
    }
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

  // Check permissions for current user
  const canCreate = hasPermission(currentMember, BRANDS_CREATE);
  const canUpdate = hasPermission(currentMember, BRANDS_UPDATE);

  // Filter brands based on selected filter
  const filteredBrands = brands.filter((brand) => {
    if (filter === "active") return brand.isActive;
    if (filter === "archived") return !brand.isActive;
    return true; // "all"
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        user={user}
        organizationName={organization.name}
        onSignOut={handleSignOut}
        currentMember={currentMember}
        pageTitle="Brands"
      />

      {/* Notification Banner */}
      {notification && (
        <div
          className={`fixed top-20 right-4 z-50 max-w-md rounded-lg shadow-lg p-4 ${
            notification.type === "success"
              ? "bg-green-50 border border-green-200"
              : "bg-red-50 border border-red-200"
          }`}
        >
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {notification.type === "success" ? (
                <svg
                  className="h-5 w-5 text-green-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5 text-red-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
            <div className="ml-3 flex-1">
              <p
                className={`text-sm font-medium ${
                  notification.type === "success"
                    ? "text-green-800"
                    : "text-red-800"
                }`}
              >
                {notification.message}
              </p>
            </div>
            <button
              onClick={() => setNotification(null)}
              className={`ml-3 inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                notification.type === "success"
                  ? "text-green-500 hover:bg-green-100 focus:ring-green-600"
                  : "text-red-500 hover:bg-red-100 focus:ring-red-600"
              }`}
            >
              <span className="sr-only">Dismiss</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Header with Create Button */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Brands</h2>
            <p className="text-gray-600 mt-1">
              Manage your organisation's brands
            </p>
          </div>
          {canCreate && (
            <button
              onClick={handleCreateBrand}
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
          <div className="mb-6 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setFilter("active")}
                className={`${
                  filter === "active"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                data-testid="filter-active"
              >
                Active
                <span
                  className={`ml-2 ${
                    filter === "active"
                      ? "bg-blue-100 text-blue-600"
                      : "bg-gray-100 text-gray-900"
                  } py-0.5 px-2.5 rounded-full text-xs font-medium`}
                >
                  {brands.filter((b) => b.isActive).length}
                </span>
              </button>
              <button
                onClick={() => setFilter("archived")}
                className={`${
                  filter === "archived"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                data-testid="filter-archived"
              >
                Archived
                <span
                  className={`ml-2 ${
                    filter === "archived"
                      ? "bg-blue-100 text-blue-600"
                      : "bg-gray-100 text-gray-900"
                  } py-0.5 px-2.5 rounded-full text-xs font-medium`}
                >
                  {brands.filter((b) => !b.isActive).length}
                </span>
              </button>
              <button
                onClick={() => setFilter("all")}
                className={`${
                  filter === "all"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                data-testid="filter-all"
              >
                All
                <span
                  className={`ml-2 ${
                    filter === "all"
                      ? "bg-blue-100 text-blue-600"
                      : "bg-gray-100 text-gray-900"
                  } py-0.5 px-2.5 rounded-full text-xs font-medium`}
                >
                  {brands.length}
                </span>
              </button>
            </nav>
          </div>
        )}

        {/* Brands List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {filteredBrands.length === 0 && brands.length === 0 ? (
            <div className="p-12 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                No brands yet
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Create your first brand to start managing events.
              </p>
              {canCreate && (
                <button
                  onClick={handleCreateBrand}
                  className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Create Your First Brand
                </button>
              )}
            </div>
          ) : filteredBrands.length === 0 ? (
            <div className="p-12 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                No {filter} brands
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                {filter === "active"
                  ? "All brands are currently archived."
                  : "No archived brands found."}
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Brand
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredBrands.map((brand) => {
                  const isRestoring =
                    restoringBrandId === fromBranded(brand.id);

                  return (
                    <tr
                      key={fromBranded(brand.id)}
                      className={`hover:bg-gray-50 cursor-pointer ${
                        !brand.isActive ? "opacity-60" : ""
                      }`}
                      onClick={() =>
                        router.push(
                          `/dashboard/brands/${fromBranded(brand.id)}`,
                        )
                      }
                    >
                      {/* Brand Info */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center">
                            <span className="text-gray-600 font-medium text-lg">
                              {brand.name[0]?.toUpperCase() || "?"}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {brand.name}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Created Date */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {brand.createdAt.toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            brand.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {brand.isActive ? "Active" : "Archived"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td
                        className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-3">
                          {!brand.isActive && canUpdate && (
                            <button
                              onClick={() => handleRestoreBrand(brand.id)}
                              disabled={isRestoring}
                              className="text-green-600 hover:text-green-900 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isRestoring ? "Restoring..." : "Restore"}
                            </button>
                          )}
                          <button
                            onClick={() =>
                              router.push(
                                `/dashboard/brands/${fromBranded(brand.id)}`,
                              )
                            }
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Manage
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Create Brand Modal */}
      {currentMember && organization && (
        <CreateBrandModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          organizationId={organization.id}
          organizationName={organization.name}
          onSuccess={handleCreateSuccess}
        />
      )}
    </div>
  );
}
