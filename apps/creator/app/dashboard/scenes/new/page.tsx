"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  getUserOrganizations,
  getOrganization,
  auth,
} from "@brayford/firebase-utils";
import {
  toBranded,
  fromBranded,
  type UserId,
  type OrganizationDocument,
  type OrganizationMemberDocument,
  hasPermission,
  EVENTS_MANAGE_MODULES,
} from "@brayford/core";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardLayoutWrapper from "@/components/dashboard/DashboardLayoutWrapper";
import SceneEditor from "@/components/scenes/SceneEditor";

export default function NewScenePage() {
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
      if (!hasPermission(currentMember, EVENTS_MANAGE_MODULES)) {
        router.push("/dashboard");
      }
    }
  }, [loading, currentMember, organization, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/signin");
  };

  const handleSave = async (data: {
    name: string;
    description?: string;
    brandId: string | null;
    eventId: string | null;
    modules: any[];
  }) => {
    if (!organization || !user) return;

    const token = await auth.currentUser?.getIdToken();
    const response = await fetch("/api/scenes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        organizationId: fromBranded(organization.id),
        brandId: data.brandId,
        eventId: data.eventId,
        name: data.name,
        description: data.description,
        modules: data.modules,
        createdBy: user.uid,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create scene");
    }

    const result = await response.json();
    router.push(`/dashboard/scenes/${result.sceneId}`);
  };

  const handleCancel = () => {
    router.push("/dashboard/scenes");
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
          pageTitle="Create Scene"
        />

        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <button
              onClick={handleCancel}
              className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
            >
              <svg
                className="w-5 h-5 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Scenes
            </button>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Create New Scene
          </h1>

          <SceneEditor
            organizationId={fromBranded(organization.id)}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </main>
      </div>
    </DashboardLayoutWrapper>
  );
}
