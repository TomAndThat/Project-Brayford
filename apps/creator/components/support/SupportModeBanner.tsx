"use client";

import { useRouter } from "next/navigation";

interface SupportModeBannerProps {
  organizationName?: string;
}

/**
 * Support mode banner shown to super admins
 *
 * Displays a persistent banner at the top of the screen when a Project Brayford
 * staff member is accessing a customer organization. Shows the org name and
 * provides an "Exit Support Mode" button to return to the admin app.
 *
 * Features:
 * - Distinctive amber/orange styling for clear visibility
 * - Non-dismissible (always visible when in support mode)
 * - Sticky positioning at top of viewport
 * - Exit button redirects to admin app organization browser
 *
 * @example
 * ```tsx
 * <SupportModeBanner organizationName="Acme Podcast Inc." />
 * ```
 */
export default function SupportModeBanner({
  organizationName,
}: SupportModeBannerProps) {
  const router = useRouter();

  const handleExitSupportMode = () => {
    // Clear any org context from localStorage
    if (typeof window !== "undefined") {
      localStorage.removeItem("brayford:selected-org-id");
    }

    // Get admin app URL from environment
    const adminAppUrl =
      process.env.NEXT_PUBLIC_ADMIN_APP_URL || "http://localhost:3001";

    // Redirect to admin app
    window.location.href = adminAppUrl;
  };

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 bg-amber-500 border-b-2 border-amber-600 shadow-md"
      data-testid="support-mode-banner"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Shield icon */}
            <svg
              className="w-5 h-5 text-amber-900"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>

            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold text-amber-900">
                Support Mode
              </span>
              {organizationName && (
                <>
                  <span className="text-amber-800">•</span>
                  <span className="text-sm font-medium text-amber-900">
                    {organizationName}
                  </span>
                </>
              )}
            </div>
          </div>

          <button
            onClick={handleExitSupportMode}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-amber-900 focus:ring-offset-2 focus:ring-offset-amber-500"
            data-testid="exit-support-mode-button"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Exit Support Mode
          </button>
        </div>
      </div>
    </div>
  );
}
