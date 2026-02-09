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
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {organization.name}
            </h1>
            <p className="text-sm text-gray-500">Project Brayford</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-700">
                {user.displayName}
              </p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
            {user.photoURL && (
              <img
                src={user.photoURL}
                alt={user.displayName || "User"}
                className="w-10 h-10 rounded-full"
              />
            )}
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

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
