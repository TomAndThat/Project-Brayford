"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

function UndoDeletionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const token = searchParams.get("token");
  const requestId = searchParams.get("requestId");

  const [status, setStatus] = useState<
    "loading" | "ready" | "processing" | "success" | "error" | "expired"
  >("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // Redirect to sign in, then back to this page
      const returnUrl = `/delete-organization/undo?token=${token}&requestId=${requestId}`;
      router.push(`/signin?returnUrl=${encodeURIComponent(returnUrl)}`);
      return;
    }

    if (!token || !requestId) {
      setStatus("error");
      setErrorMessage("Invalid undo link. Missing token or request ID.");
    } else {
      setStatus("ready");
    }
  }, [user, authLoading, token, requestId, router]);

  const handleUndo = useCallback(async () => {
    if (!token || !requestId || !user) return;

    setStatus("processing");

    try {
      const idToken = await user.getIdToken();

      const response = await fetch("/api/organizations/deletion/undo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ token, requestId }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 410) {
          setStatus("expired");
          setErrorMessage(data.error);
        } else {
          setStatus("error");
          setErrorMessage(data.error || "Failed to undo deletion.");
        }
        return;
      }

      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMessage("An unexpected error occurred. Please try again.");
    }
  }, [token, requestId, user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        {status === "loading" && (
          <div className="text-center">
            <div className="text-lg text-gray-600">Loading…</div>
          </div>
        )}

        {status === "ready" && (
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
              />
            </svg>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">
              Undo Organisation Deletion
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Click below to cancel the scheduled deletion and restore your
              organisation.
            </p>
            <div className="mt-6">
              <button
                onClick={handleUndo}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Undo Deletion
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="mt-3 w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        )}

        {status === "processing" && (
          <div className="text-center">
            <svg
              className="animate-spin mx-auto h-10 w-10 text-blue-500"
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
              Restoring your organisation.
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">
              Deletion Cancelled
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Your organisation has been restored. All data and access remains
              intact.
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-6 w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Return to Dashboard
            </button>
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
              Undo Window Expired
            </h1>
            <p className="mt-2 text-sm text-gray-600">{errorMessage}</p>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-6 w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Return to Dashboard
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

export default function UndoDeletionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-lg text-gray-600">Loading…</div>
        </div>
      }
    >
      <UndoDeletionContent />
    </Suspense>
  );
}
