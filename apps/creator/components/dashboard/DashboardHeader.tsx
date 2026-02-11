"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OrganizationMemberDocument } from "@brayford/core";
import { hasPermission, ORG_VIEW_SETTINGS } from "@brayford/core";

interface DashboardHeaderProps {
  user: {
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
  };
  organizationName: string;
  onSignOut: () => Promise<void>;
  pageTitle?: string; // Optional page title override
  /** Optional org switcher rendered below the title */
  orgSwitcher?: ReactNode;
  /** Optional current member for permission checks */
  currentMember?: OrganizationMemberDocument;
}

/**
 * Reusable dashboard header with user profile dropdown and home navigation
 * Used across all dashboard pages for consistent UX
 */
export default function DashboardHeader({
  user,
  organizationName,
  onSignOut,
  pageTitle,
  orgSwitcher,
  currentMember,
}: DashboardHeaderProps) {
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Determine if we're on the home dashboard
  const isOnHomePage = !pageTitle;

  // Check permissions
  const canViewSettings = currentMember
    ? hasPermission(currentMember, ORG_VIEW_SETTINGS)
    : false;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isDropdownOpen]);

  const handleSignOut = async () => {
    setIsDropdownOpen(false);
    await onSignOut();
  };

  // Get user initials for fallback avatar
  const userInitial = user.displayName?.charAt(0).toUpperCase() || "U";

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <div>
          {breadcrumb && (
            <button
              onClick={breadcrumb.onClick}
              data-testid="breadcrumb-back"
              className="text-sm text-blue-600 hover:text-blue-800 mb-1 flex items-center gap-1"
            >
              <svg
                className="w-4 h-4"
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
              {breadcrumb.label}
            </button>
          )}
          <h1
            data-testid="header-org-name"
            className="text-2xl font-bold text-gray-900"
          >
            {pageTitle || organizationName}
          </h1>
          <p className="text-sm text-gray-500">
            {pageTitle ? organizationName : "Project Brayford"}
          </p>
          {orgSwitcher}
        </div>

        {/* User Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            data-testid="user-profile-btn"
            className="flex items-center gap-3 hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors"
          >
            <div className="text-right">
              <p className="text-sm font-medium text-gray-700">
                {user.displayName}
              </p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || "User"}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                {userInitial}
              </div>
            )}
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform ${
                isDropdownOpen ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
              {canViewSettings && (
                <>
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      router.push("/dashboard/organisation/settings");
                    }}
                    data-testid="header-settings-btn"
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    Organisation Settings
                  </button>
                  <div className="border-t border-gray-200 my-1" />
                </>
              )}
              <Link
                href="/help"
                onClick={() => setIsDropdownOpen(false)}
                className="w-full block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <span className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Help & Support
                </span>
              </Link>
              <div className="border-t border-gray-200 my-1" />
              <button
                onClick={handleSignOut}
                data-testid="header-signout-btn"
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
