"use client";

import { useAuth } from "@/contexts/auth";
import { signOut } from "@brayford/firebase-utils";
import { useRouter } from "next/navigation";

export default function AccessDeniedPage() {
  const { user } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <svg
              className="h-6 w-6 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-lg font-semibold text-zinc-900">Access Denied</h1>
        <p className="mt-2 text-sm text-zinc-500">
          {user?.email ? (
            <>
              <strong className="font-medium text-zinc-700">
                {user.email}
              </strong>{" "}
              does not have permission to access this portal.
            </>
          ) : (
            "Your account does not have permission to access this portal."
          )}
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          Contact a Project Brayford administrator to request access.
        </p>

        <button
          onClick={handleSignOut}
          className="mt-6 w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
