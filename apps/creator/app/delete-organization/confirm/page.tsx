"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function ConfirmDeletionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get("token");
  const requestId = searchParams.get("requestId");

  const [status, setStatus] = useState<
    "loading" | "confirming" | "confirmed" | "error" | "expired"
  >("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [scheduledDate, setScheduledDate] = useState<string>("");

  const confirmDeletion = useCallback(async () => {
    if (!token || !requestId) {
      setStatus("error");
      setErrorMessage(
        "Invalid confirmation link. Missing token or request ID.",
      );
      return;
    }

    setStatus("confirming");

    try {
      const response = await fetch("/api/organizations/deletion/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, requestId }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 410) {
          setStatus("expired");
          setErrorMessage(data.error);
        } else {
          setStatus("error");
          setErrorMessage(data.error || "Failed to confirm deletion.");
        }
        return;
      }

      setStatus("confirmed");
      setScheduledDate(
        new Date(data.scheduledDeletionAt).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      );
    } catch {
      setStatus("error");
      setErrorMessage("An unexpected error occurred. Please try again.");
    }
  }, [token, requestId]);

  useEffect(() => {
    // Don't auto-confirm — require the user to click the button
    if (!token || !requestId) {
      setStatus("error");
      setErrorMessage("Invalid confirmation link.");
    } else {
      setStatus("loading");
    }
  }, [token, requestId]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        {status === "loading" && (
          <>
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h1 className="mt-4 text-2xl font-bold text-gray-900">
                Confirm Organisation Deletion
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                You are about to confirm the permanent deletion of your
                organisation. If you proceed, you will have 24 hours to change
                your mind before all data is permanently removed.
              </p>
              <div className="mt-6">
                <button
                  onClick={confirmDeletion}
                  className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Confirm Deletion
                </button>
                <button
                  onClick={() => router.push("/dashboard")}
                  className="mt-3 w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel — Return to Dashboard
                </button>
              </div>
            </div>
          </>
        )}

        {status === "confirming" && (
          <div className="text-center">
            <svg
              className="animate-spin mx-auto h-10 w-10 text-red-500"
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
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <h1 className="mt-4 text-xl font-bold text-gray-900">
              Processing…
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Please wait while we confirm the deletion.
            </p>
          </div>
        )}

        {status === "confirmed" && (
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-amber-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">
              Deletion Confirmed
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Your organisation deletion has been confirmed. You have{" "}
              <strong>24 hours</strong> to change your mind.
            </p>
            <p className="mt-2 text-sm text-gray-500">
              All members with the appropriate permissions have been notified
              and will receive a link to undo this action.
            </p>
          </div>
        )}

        {status === "expired" && (
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">
              Link Expired
            </h1>
            <p className="mt-2 text-sm text-gray-600">{errorMessage}</p>
            <button
              onClick={() => router.push("/dashboard/organisation/settings")}
              className="mt-6 w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Go to Organisation Settings
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">Error</h1>
            <p className="mt-2 text-sm text-gray-600">{errorMessage}</p>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-6 w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Return to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ConfirmDeletionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-lg text-gray-600">Loading…</div>
        </div>
      }
    >
      <ConfirmDeletionContent />
    </Suspense>
  );
}
