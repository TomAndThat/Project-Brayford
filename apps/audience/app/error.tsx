"use client";

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Audience app — root error boundary.
 *
 * Catches unhandled runtime errors within the app and presents a recoverable
 * error screen rather than a blank page or the default Next.js error output.
 * Must be a Client Component (Next.js requirement for error boundaries).
 */
export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("Audience app error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-6 mx-auto h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
          <svg
            className="h-8 w-8 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h1 className="mb-3 text-2xl font-semibold text-zinc-900">
          Something Went Wrong
        </h1>
        <p className="mb-6 text-lg text-zinc-600">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
