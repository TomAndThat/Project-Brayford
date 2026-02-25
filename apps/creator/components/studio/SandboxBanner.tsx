"use client";

/**
 * SandboxBanner
 *
 * Persistent amber banner shown at the top of the studio when the current
 * event is a sandbox test event. Clearly signals that activity in this event
 * is not billable and not visible to a live audience.
 */

interface SandboxBannerProps {
  onReset?: () => void;
  resetLoading?: boolean;
}

export default function SandboxBanner({
  onReset,
  resetLoading = false,
}: SandboxBannerProps) {
  return (
    <div className="flex items-center justify-between gap-4 bg-amber-400 px-4 py-2 text-amber-950">
      <div className="flex items-center gap-2 min-w-0">
        <svg
          className="w-4 h-4 shrink-0"
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
        <span className="text-sm font-semibold">Test Event</span>
        <span className="hidden sm:inline text-sm">
          — Activity here is not billable and not part of any live show.
        </span>
      </div>
      {onReset && (
        <button
          onClick={onReset}
          disabled={resetLoading}
          className="shrink-0 rounded px-3 py-1 text-xs font-semibold bg-amber-950 text-amber-50 hover:bg-amber-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {resetLoading ? "Resetting…" : "Reset Test Event"}
        </button>
      )}
    </div>
  );
}
