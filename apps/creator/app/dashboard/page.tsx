"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  getUserOrganizations,
  getOrganization,
  getOrganizationBrands,
} from "@brayford/firebase-utils";
import {
  toBranded,
  type UserId,
  type OrganizationDocument,
  type BrandDocument,
} from "@brayford/core";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

export default function DashboardPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<OrganizationDocument | null>(
    null,
  );
  const [brands, setBrands] = useState<BrandDocument[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/signin");
      return;
    }

    if (user) {
      loadUserData();
    }
  }, [user, authLoading, router]);

  const loadUserData = async () => {
    if (!user) return;

    try {
      const userId = toBranded<UserId>(user.uid);
      const memberships = await getUserOrganizations(userId);

      if (memberships.length === 0) {
        // No organization yet, redirect to onboarding
        router.push("/onboarding");
        return;
      }

      // Get first organization (for now, assuming single org per user)
      const orgId = memberships[0]!.organizationId;
      const org = await getOrganization(orgId);

      if (org) {
        setOrganization(org);
        // Load brands for this organization
        const orgBrands = await getOrganizationBrands(orgId);
        setBrands(orgBrands);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/signin");
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user || !organization) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        user={user}
        organizationName={organization.name}
        onSignOut={handleSignOut}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome Section */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to your Dashboard!
          </h2>
          <p className="text-lg text-gray-600">
            You're all set up. Let's create your first event.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <button
            onClick={() => router.push("/dashboard/users")}
            className="bg-white rounded-lg shadow-md p-6 text-left hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Team Members
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Manage your organisation's users
                </p>
              </div>
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </div>
          </button>

          <div className="bg-gray-100 rounded-lg shadow-md p-6 opacity-50 cursor-not-allowed">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Events</h3>
                <p className="text-sm text-gray-600 mt-1">Coming soon</p>
              </div>
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          </div>

          <div className="bg-gray-100 rounded-lg shadow-md p-6 opacity-50 cursor-not-allowed">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Analytics
                </h3>
                <p className="text-sm text-gray-600 mt-1">Coming soon</p>
              </div>
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Brands Section */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Your Brands
          </h3>
          {brands.length > 0 ? (
            <div className="space-y-2">
              {brands.map((brand) => (
                <div
                  key={fromBranded(brand.id)}
                  className="p-4 border border-gray-200 rounded-md"
                >
                  <h4 className="font-medium text-gray-900">{brand.name}</h4>
                  {brand.description && (
                    <p className="text-sm text-gray-600 mt-1">
                      {brand.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">No brands yet.</p>
          )}
        </div>

        {/* Empty State - Create Event */}
        <div className="bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-blue-400"
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
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            Create your first event
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            Start engaging your audience with live Q&A, polls, and more.
          </p>
          <button
            className="mt-6 inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            disabled
          >
            Create Event (Coming Soon)
          </button>
        </div>
      </main>
    </div>
  );
}

function fromBranded<T extends { toString(): string }>(branded: T): string {
  return branded.toString();
}
