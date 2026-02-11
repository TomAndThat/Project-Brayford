"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  getUserOrganizations,
  getOrganization,
  getOrganizationBrands,
  getOrganizationEvents,
} from "@brayford/firebase-utils";
import {
  toBranded,
  type UserId,
  type OrganizationId,
  type OrganizationDocument,
  type OrganizationMemberDocument,
  type BrandDocument,
  type EventDocument,
  hasPermission,
  USERS_VIEW,
  BRANDS_VIEW,
  EVENTS_VIEW,
} from "@brayford/core";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardLayoutWrapper from "@/components/dashboard/DashboardLayoutWrapper";
import OrgSwitcher, {
  type OrgSwitcherItem,
} from "@/components/dashboard/OrgSwitcher";

// Local storage key for persisting the selected org
const SELECTED_ORG_KEY = "brayford:selected-org-id";

export default function DashboardPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<OrganizationDocument | null>(
    null,
  );
  const [brands, setBrands] = useState<BrandDocument[]>([]);
  const [events, setEvents] = useState<EventDocument[]>([]);
  const [allOrgs, setAllOrgs] = useState<OrgSwitcherItem[]>([]);
  const [memberships, setMemberships] = useState<OrganizationMemberDocument[]>(
    [],
  );
  const [currentMember, setCurrentMember] =
    useState<OrganizationMemberDocument | null>(null);

  const loadOrgData = useCallback(
    async (orgId: OrganizationId) => {
      const org = await getOrganization(orgId);

      // Check if organization is soft-deleted
      if (org?.softDeletedAt) {
        // Organization has been deleted, redirect to onboarding
        if (typeof window !== "undefined") {
          localStorage.removeItem(SELECTED_ORG_KEY);
        }
        router.push("/onboarding");
        return;
      }

      if (org) {
        setOrganization(org);
        const orgBrands = await getOrganizationBrands(orgId);
        setBrands(orgBrands);
        const orgEvents = await getOrganizationEvents(orgId);
        setEvents(orgEvents);
        // Persist the selected org
        if (typeof window !== "undefined") {
          localStorage.setItem(SELECTED_ORG_KEY, orgId as string);
        }
      }
    },
    [router],
  );

  const loadUserData = useCallback(async () => {
    if (!user) return;

    try {
      const userId = toBranded<UserId>(user.uid);
      const userMemberships = await getUserOrganizations(userId);

      if (userMemberships.length === 0) {
        router.push("/onboarding");
        return;
      }

      setMemberships(userMemberships);

      // Load org names for the switcher - filter out soft-deleted organizations
      const orgItemsWithNulls = await Promise.all(
        userMemberships.map(async (m) => {
          const org = await getOrganization(m.organizationId);
          // Skip soft-deleted organizations
          if (org?.softDeletedAt) {
            return null;
          }
          return {
            id: m.organizationId,
            name: org?.name ?? "Unknown",
            role: m.role,
          } as OrgSwitcherItem;
        }),
      );
      const orgItems = orgItemsWithNulls.filter(
        (item): item is OrgSwitcherItem => item !== null,
      );

      // If no active organizations remain, redirect to onboarding
      if (orgItems.length === 0) {
        router.push("/onboarding");
        return;
      }

      setAllOrgs(orgItems);

      // Determine which org to show
      const savedOrgId =
        typeof window !== "undefined"
          ? localStorage.getItem(SELECTED_ORG_KEY)
          : null;
      const savedMembership = savedOrgId
        ? userMemberships.find(
            (m) => (m.organizationId as string) === savedOrgId,
          )
        : null;

      // Ensure the saved org is not soft-deleted
      let targetMembership = savedMembership;
      if (targetMembership) {
        const savedOrg = await getOrganization(targetMembership.organizationId);
        if (savedOrg?.softDeletedAt) {
          targetMembership = null; // Fall back to first active org
        }
      }

      // Fall back to first active organization
      if (!targetMembership) {
        const firstActiveOrgId = orgItems[0]?.id;
        targetMembership =
          userMemberships.find((m) => m.organizationId === firstActiveOrgId) ||
          userMemberships[0]!;
      }

      setCurrentMember(targetMembership);

      await loadOrgData(targetMembership.organizationId);
    } catch (error) {
      console.error("Error loading user data:", error);
    } finally {
      setLoading(false);
    }
  }, [user, router, loadOrgData]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/signin");
      return;
    }

    if (user) {
      loadUserData();
    }
  }, [user, authLoading, router, loadUserData]);

  const handleOrgChange = async (orgId: OrganizationId) => {
    setLoading(true);
    const membership = memberships.find((m) => m.organizationId === orgId);
    if (membership) {
      setCurrentMember(membership);
    }
    await loadOrgData(orgId);
    setLoading(false);
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
    <DashboardLayoutWrapper organizationName={organization.name}>
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader
          user={user}
          organizationName={organization.name}
          onSignOut={handleSignOut}
          currentMember={currentMember ?? undefined}
          orgSwitcher={
            allOrgs.length > 1 ? (
              <OrgSwitcher
                organizations={allOrgs}
                currentOrgId={organization.id}
                onOrgChange={handleOrgChange}
              />
            ) : undefined
          }
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
            {currentMember && hasPermission(currentMember, USERS_VIEW) && (
              <button
                onClick={() => router.push("/dashboard/users")}
                data-testid="team-members-card"
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
            )}

            {currentMember && hasPermission(currentMember, BRANDS_VIEW) && (
              <button
                onClick={() => router.push("/dashboard/brands")}
                data-testid="brands-card"
                className="bg-white rounded-lg shadow-md p-6 text-left hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Brands
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Manage your organisation's brands
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
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
              </button>
            )}

            {currentMember && hasPermission(currentMember, EVENTS_VIEW) && (
              <button
                onClick={() => router.push("/dashboard/events")}
                data-testid="events-card"
                className="bg-white rounded-lg shadow-md p-6 text-left hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Events
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Manage your organisation's events
                    </p>
                  </div>
                  <svg
                    className="w-8 h-8 text-purple-600"
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
              </button>
            )}
          </div>

          {/* Events Section */}
          <div
            data-testid="events-section"
            className="bg-white rounded-lg shadow-md p-8 mb-8"
          >
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Your Events
            </h3>
            {events.length > 0 ? (
              <div className="space-y-2">
                {events.slice(0, 5).map((event) => (
                  <div
                    key={fromBranded(event.id)}
                    className="p-4 border border-gray-200 rounded-md"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {event.name}
                        </h4>
                        <p className="text-sm text-gray-500 mt-1">
                          {event.scheduledDate.toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}{" "}
                          at {event.scheduledStartTime}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          event.status === "draft"
                            ? "bg-gray-100 text-gray-800"
                            : event.status === "active"
                              ? "bg-green-100 text-green-800"
                              : event.status === "live"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-red-100 text-red-800"
                        }`}
                      >
                        {event.status.charAt(0).toUpperCase() +
                          event.status.slice(1)}
                      </span>
                    </div>
                  </div>
                ))}
                {events.length > 5 && (
                  <p className="text-sm text-gray-500 text-center pt-2">
                    ...and {events.length - 5} more events
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-600">No events yet.</p>
            )}
          </div>
        </main>
      </div>
    </DashboardLayoutWrapper>
  );
}

function fromBranded<T extends { toString(): string }>(branded: T): string {
  return branded.toString();
}
