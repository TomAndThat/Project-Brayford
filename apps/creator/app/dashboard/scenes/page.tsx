"use client";

import { useEffect, useState, useCallback } from "react";
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
  EVENTS_MANAGE_MODULES,
} from "@brayford/core";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardLayoutWrapper from "@/components/dashboard/DashboardLayoutWrapper";

export default function ScenesPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<OrganizationDocument | null>(
    null,
  );
  const [currentMember, setCurrentMember] =
    useState<OrganizationMemberDocument | null>(null);

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

      const orgId = currentMembership.organizationId;
      const org = await getOrganization(orgId);

      if (org) {
        setOrganization(org);
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

  useEffect(() => {
    if (!loading && currentMember && organization) {
      if (!hasPermission(currentMember, EVENTS_MANAGE_MODULES)) {
        router.push("/dashboard");
      }
    }
  }, [loading, currentMember, organization, router]);

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

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Empty State */}
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
                d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 016 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5"
              />
            </svg>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Scenes</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Scenes let you build reusable screen layouts for your live events.
              Compose modules like Q&amp;A, polls, countdowns and more — then
              switch between them in real time.
            </p>
            <p className="text-sm text-gray-400 mt-6">
              Scene builder coming soon.
            </p>
          </div>
        </main>
      </div>
    </DashboardLayoutWrapper>
  );
}
