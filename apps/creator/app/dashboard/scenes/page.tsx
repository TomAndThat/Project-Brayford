"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  getUserOrganizations,
  getOrganization,
  getOrganizationBrands,
  getOrganizationEvents,
  auth,
} from "@brayford/firebase-utils";
import {
  toBranded,
  fromBranded,
  type UserId,
  type OrganizationDocument,
  type OrganizationMemberDocument,
  type BrandDocument,
  type EventDocument,
  type SceneDocument,
  hasPermission,
  EVENTS_MANAGE_MODULES,
} from "@brayford/core";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardLayoutWrapper from "@/components/dashboard/DashboardLayoutWrapper";

type ScopeFilter = "all" | "org" | string; // "all", "org", "brand:{id}", "event:{id}"

export default function ScenesPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<OrganizationDocument | null>(
    null,
  );
  const [currentMember, setCurrentMember] =
    useState<OrganizationMemberDocument | null>(null);
  const [scenes, setScenes] = useState<(SceneDocument & { id: string })[]>([]);
  const [brands, setBrands] = useState<BrandDocument[]>([]);
  const [events, setEvents] = useState<EventDocument[]>([]);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
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

      const currentMembership = memberships[0]!;
      setCurrentMember(currentMembership);

      const orgId = currentMembership.organizationId;
      const org = await getOrganization(orgId);

      if (!org) {
        router.push("/dashboard");
        return;
      }

      setOrganization(org);

      // Load brands (excluding archived)
      const orgBrands = await getOrganizationBrands(orgId, true);
      setBrands(orgBrands);

      // Load events (excluding archived)
      const orgEvents = await getOrganizationEvents(orgId, true);
      setEvents(orgEvents);

      // Load scenes from API
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/scenes", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setScenes(data.scenes || []);
      } else {
        console.error("Failed to load scenes");
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

  // Filter and search scenes
  const filteredScenes = useMemo(() => {
    let filtered = scenes;

    // Apply scope filter
    if (scopeFilter === "org") {
      filtered = filtered.filter(
        (s) => s.brandId === null && s.eventId === null,
      );
    } else if (scopeFilter.startsWith("brand:")) {
      const brandId = scopeFilter.slice(6);
      filtered = filtered.filter(
        (s) => fromBranded(s.brandId) === brandId && s.eventId === null,
      );
    } else if (scopeFilter.startsWith("event:")) {
      const eventId = scopeFilter.slice(6);
      filtered = filtered.filter((s) => fromBranded(s.eventId) === eventId);
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((s) => {
        const sceneName = s.name.toLowerCase();
        const sceneDesc = (s.description || "").toLowerCase();

        // Find brand and event names
        const brand = brands.find(
          (b) => fromBranded(b.id) === fromBranded(s.brandId),
        );
        const event = events.find(
          (e) => fromBranded(e.id) === fromBranded(s.eventId),
        );

        const brandName = brand?.name.toLowerCase() || "";
        const eventName = event?.name.toLowerCase() || "";

        return (
          sceneName.includes(query) ||
          sceneDesc.includes(query) ||
          brandName.includes(query) ||
          eventName.includes(query)
        );
      });
    }

    return filtered;
  }, [scenes, scopeFilter, searchQuery, brands, events]);

  const getScopeLabel = (scene: SceneDocument) => {
    if (scene.eventId !== null) {
      const event = events.find(
        (e) => fromBranded(e.id) === fromBranded(scene.eventId),
      );
      return event ? `Event: ${event.name}` : "Event";
    }
    if (scene.brandId !== null) {
      const brand = brands.find(
        (b) => fromBranded(b.id) === fromBranded(scene.brandId),
      );
      return brand ? `Brand: ${brand.name}` : "Brand";
    }
    return "Organisation-wide";
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

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Notification */}
          {notification && (
            <div
              className={`mb-6 p-4 rounded-md ${
                notification.type === "success"
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
              }`}
            >
              <p className="text-sm font-medium">{notification.message}</p>
            </div>
          )}

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
          <div className="mb-6 bg-white rounded-lg shadow-sm p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Scope filter */}
              <div>
                <label
                  htmlFor="scope-filter"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Scope
                </label>
                <select
                  id="scope-filter"
                  value={scopeFilter}
                  onChange={(e) => setScopeFilter(e.target.value)}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="all">All Scenes</option>
                  <option value="org">Organisation-wide</option>
                  <optgroup label="Brands">
                    {brands.map((brand) => (
                      <option
                        key={fromBranded(brand.id)}
                        value={`brand:${fromBranded(brand.id)}`}
                      >
                        {brand.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Events">
                    {events.map((event) => (
                      <option
                        key={fromBranded(event.id)}
                        value={`event:${fromBranded(event.id)}`}
                      >
                        {event.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

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
                  placeholder="Search scenes, brands, or events..."
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>
          </div>

          {/* Scene list */}
          {filteredScenes.length === 0 ? (
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
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {searchQuery || scopeFilter !== "all"
                  ? "No scenes found"
                  : "No scenes yet"}
              </h3>
              <p className="text-gray-600 max-w-md mx-auto">
                {searchQuery || scopeFilter !== "all"
                  ? "Try adjusting your filters or search query."
                  : "Create your first scene to start building screen layouts for your events."}
              </p>
              {!searchQuery && scopeFilter === "all" && (
                <button
                  onClick={() => router.push("/dashboard/scenes/new")}
                  className="mt-6 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Create Your First Scene
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredScenes.map((scene) => (
                <div
                  key={scene.id}
                  onClick={() => router.push(`/dashboard/scenes/${scene.id}`)}
                  className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 flex-1">
                        {scene.name}
                      </h3>
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        {scene.modules.length}{" "}
                        {scene.modules.length === 1 ? "module" : "modules"}
                      </span>
                    </div>
                    {scene.description && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                        {scene.description}
                      </p>
                    )}
                    <div className="flex items-center text-xs text-gray-500">
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                        />
                      </svg>
                      {getScopeLabel(scene)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </DashboardLayoutWrapper>
  );
}
