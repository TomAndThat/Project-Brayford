"use client";

import { useRouter } from "next/navigation";
import {
  hasPermission,
  USERS_VIEW,
  BRANDS_VIEW,
  EVENTS_VIEW,
  EVENTS_MANAGE_MODULES,
  IMAGES_VIEW,
  type OrganizationMemberDocument,
} from "@brayford/core";

interface DashboardQuickActionsProps {
  currentMember: OrganizationMemberDocument;
  sandboxLoading: boolean;
  sandboxError: string | null;
  onOpenSandbox: () => void;
}

export default function DashboardQuickActions({
  currentMember,
  sandboxLoading,
  sandboxError,
  onOpenSandbox,
}: DashboardQuickActionsProps) {
  const router = useRouter();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Test Event — always visible to all org members */}
      <div className="col-span-1 md:col-span-2 lg:col-span-4">
        <button
          onClick={onOpenSandbox}
          disabled={sandboxLoading}
          data-testid="sandbox-card"
          className="w-full bg-amber-50 border-2 border-amber-300 rounded-lg shadow-sm p-6 text-left hover:shadow-md hover:bg-amber-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-200 text-amber-800">
                  Test Mode
                </span>
              </div>
              <h3 className="text-lg font-semibold text-amber-900">
                Open Test Event
              </h3>
              <p className="text-sm text-amber-700 mt-1">
                A private sandbox for training and practice. Not billable. Up to
                100 audience members.
              </p>
              {sandboxError && (
                <p className="text-sm text-red-600 mt-2">{sandboxError}</p>
              )}
            </div>
            <div className="ml-4 shrink-0">
              {sandboxLoading ? (
                <svg
                  className="w-8 h-8 text-amber-500 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-8 h-8 text-amber-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              )}
            </div>
          </div>
        </button>
      </div>

      {hasPermission(currentMember, USERS_VIEW) && (
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
                Manage your organisation&apos;s users
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

      {hasPermission(currentMember, BRANDS_VIEW) && (
        <button
          onClick={() => router.push("/dashboard/brands")}
          data-testid="brands-card"
          className="bg-white rounded-lg shadow-md p-6 text-left hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Brands</h3>
              <p className="text-sm text-gray-600 mt-1">
                Manage your organisation&apos;s brands
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

      {hasPermission(currentMember, EVENTS_VIEW) && (
        <button
          onClick={() => router.push("/dashboard/events")}
          data-testid="events-card"
          className="bg-white rounded-lg shadow-md p-6 text-left hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Events</h3>
              <p className="text-sm text-gray-600 mt-1">
                Manage your organisation&apos;s events
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

      {hasPermission(currentMember, EVENTS_MANAGE_MODULES) && (
        <button
          onClick={() => router.push("/dashboard/scenes")}
          data-testid="scenes-card"
          className="bg-white rounded-lg shadow-md p-6 text-left hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Scenes</h3>
              <p className="text-sm text-gray-600 mt-1">
                Build reusable screen layouts
              </p>
            </div>
            <svg
              className="w-8 h-8 text-indigo-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
              />
            </svg>
          </div>
        </button>
      )}

      {hasPermission(currentMember, IMAGES_VIEW) && (
        <button
          onClick={() => router.push("/dashboard/images")}
          data-testid="images-card"
          className="bg-white rounded-lg shadow-md p-6 text-left hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Images</h3>
              <p className="text-sm text-gray-600 mt-1">
                Manage your image library
              </p>
            </div>
            <svg
              className="w-8 h-8 text-emerald-600"
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
          </div>
        </button>
      )}
    </div>
  );
}
