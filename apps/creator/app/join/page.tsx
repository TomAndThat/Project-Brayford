"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { auth } from "@brayford/firebase-utils";
import {
  fromBranded,
  type InvitationDocument,
  type InvitationId,
  isInvitationExpired,
  isInvitationActionable,
  getRoleDisplayName,
  toBranded,
} from "@brayford/core";

/**
 * Join page — handles invitation acceptance flow
 *
 * URL: /join?token=abc123
 *
 * Flows:
 * 1. New user: Validate token → show invitation → auth → accept via API → redirect
 * 2. Existing user (signed in): Validate token → show invitation → accept via API → redirect
 * 3. Multiple invitations: Show all pending invitations for the user's email
 */

type JoinState =
  | "loading"
  | "invalid-token"
  | "expired"
  | "already-used"
  | "show-invitation"
  | "needs-auth"
  | "email-mismatch"
  | "accepting"
  | "success"
  | "error";

function JoinPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading, signIn } = useAuth();

  const token = searchParams.get("token");

  const [state, setState] = useState<JoinState>("loading");
  const [primaryInvitation, setPrimaryInvitation] =
    useState<InvitationDocument | null>(null);
  const [allInvitations, setAllInvitations] = useState<InvitationDocument[]>(
    [],
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Step 1: Validate token and load invitation
  const loadInvitation = useCallback(async () => {
    if (!token) {
      setState("invalid-token");
      return;
    }

    try {
      // Fetch invitation via public API (works for unauthenticated users)
      const response = await fetch(`/api/invitations/token/${token}`);

      if (!response.ok) {
        if (response.status === 404) {
          setState("invalid-token");
        } else {
          throw new Error("Failed to fetch invitation");
        }
        return;
      }

      const { invitation: rawInvitation } = await response.json();

      // Convert ISO date strings back to Date objects and apply branded types
      const invitation: InvitationDocument = {
        ...rawInvitation,
        id: toBranded<InvitationId>(rawInvitation.id),
        invitedAt: new Date(rawInvitation.invitedAt),
        expiresAt: new Date(rawInvitation.expiresAt),
        acceptedAt: rawInvitation.acceptedAt
          ? new Date(rawInvitation.acceptedAt)
          : undefined,
      };

      if (invitation.status === "accepted") {
        setState("already-used");
        return;
      }

      if (invitation.status === "declined") {
        setErrorMessage(
          "You declined this invitation. Contact the inviter if you'd like a new one.",
        );
        setState("already-used");
        return;
      }

      if (invitation.status === "expired" || isInvitationExpired(invitation)) {
        setPrimaryInvitation(invitation);
        setState("expired");
        return;
      }

      setPrimaryInvitation(invitation);

      // If user is already authed, check email match and load all invitations
      if (user) {
        if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
          setState("email-mismatch");
          return;
        }

        // Load all pending invitations for this email via authenticated API
        const currentUser = auth.currentUser;
        if (!currentUser) {
          setState("needs-auth");
          return;
        }

        const idToken = await currentUser.getIdToken();
        const pendingResponse = await fetch("/api/invitations/pending", {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (!pendingResponse.ok) {
          throw new Error("Failed to fetch pending invitations");
        }

        const { invitations: rawPending } = await pendingResponse.json();

        // Convert and filter to only actionable invitations
        const pending: InvitationDocument[] = rawPending.map((inv: any) => ({
          ...inv,
          id: toBranded<InvitationId>(inv.id),
          invitedAt: new Date(inv.invitedAt),
          expiresAt: new Date(inv.expiresAt),
          acceptedAt: inv.acceptedAt ? new Date(inv.acceptedAt) : undefined,
        }));

        const actionable = pending.filter(isInvitationActionable);
        setAllInvitations(actionable);
        setSelectedIds(new Set(actionable.map((i) => fromBranded(i.id))));
        setState("show-invitation");
      } else {
        setState("needs-auth");
      }
    } catch (error) {
      console.error("Failed to load invitation:", error);
      setErrorMessage("Something went wrong loading your invitation.");
      setState("error");
    }
  }, [token, user]);

  useEffect(() => {
    if (!authLoading) {
      loadInvitation();
    }
  }, [authLoading, loadInvitation]);

  // Step 2: Handle authentication
  const handleSignIn = async () => {
    try {
      await signIn();
      // Auth state change will trigger re-evaluation via useEffect
    } catch (error) {
      console.error("Sign-in error:", error);
    }
  };

  // Step 3: Accept selected invitations via server-side API
  const handleAccept = async () => {
    if (selectedIds.size === 0) return;

    setState("accepting");
    setErrorMessage(null);

    try {
      // Get the current user's ID token for the API call
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setState("needs-auth");
        return;
      }

      const idToken = await currentUser.getIdToken();

      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          invitationIds: Array.from(selectedIds),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Acceptance failed");
      }

      const result = await response.json();

      if (result.errors.length > 0) {
        console.error("Some invitations had errors:", result.errors);
      }

      setState("success");

      // Redirect after a brief delay
      setTimeout(() => {
        // If multiple orgs joined, they'll see the org switcher on the dashboard
        router.push("/dashboard");
      }, 2000);
    } catch (error) {
      console.error("Failed to accept invitation:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
      setState("show-invitation");
    }
  };

  // Step 4: Decline invitation
  const handleDecline = async () => {
    if (!primaryInvitation) return;

    const confirmed = window.confirm(
      "Are you sure you want to decline this invitation?",
    );
    if (!confirmed) return;

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setState("needs-auth");
        return;
      }

      // Decline via server-side API
      const idToken = await currentUser.getIdToken();
      const res = await fetch(
        `/api/invitations/${fromBranded(primaryInvitation.id)}/decline`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
        },
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to decline invitation");
      }

      setErrorMessage(
        "Invitation declined. Contact the inviter if you change your mind.",
      );
      setState("already-used");
    } catch (error) {
      console.error("Failed to decline invitation:", error);
    }
  };

  const toggleInvitation = (id: InvitationId) => {
    const idStr = fromBranded(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(idStr)) {
        next.delete(idStr);
      } else {
        next.add(idStr);
      }
      return next;
    });
  };

  // ===== Render States =====

  // Loading
  if (state === "loading" || authLoading) {
    return (
      <PageShell>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading your invitation…</p>
        </div>
      </PageShell>
    );
  }

  // Invalid token
  if (state === "invalid-token") {
    return (
      <PageShell>
        <ErrorCard
          title="Invalid invitation link"
          message="This invitation link is not valid. Please check the link or contact the person who invited you."
        />
      </PageShell>
    );
  }

  // Expired
  if (state === "expired") {
    return (
      <PageShell>
        <ErrorCard
          title="Invitation expired"
          message={`This invitation expired on ${primaryInvitation?.expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}. Contact ${primaryInvitation?.metadata?.inviterName || "the inviter"} for a new invitation.`}
        />
      </PageShell>
    );
  }

  // Already used / declined
  if (state === "already-used") {
    return (
      <PageShell>
        <ErrorCard
          title="Invitation no longer available"
          message={errorMessage || "This invitation has already been used."}
          showDashboardLink={!!user}
        />
      </PageShell>
    );
  }

  // Email mismatch
  if (state === "email-mismatch") {
    return (
      <PageShell>
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Wrong account
          </h2>
          <p className="text-gray-600 mb-2">
            This invitation was sent to{" "}
            <strong>{primaryInvitation?.email}</strong>.
          </p>
          <p className="text-gray-600 mb-6">
            You're signed in as <strong>{user?.email}</strong>. Please sign out
            and sign in with the correct account.
          </p>
          <button
            onClick={async () => {
              const { signOut } = await import("@brayford/firebase-utils");
              await signOut();
              // Reload will re-trigger the flow
              window.location.reload();
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Sign Out
          </button>
        </div>
      </PageShell>
    );
  }

  // Needs authentication
  if (state === "needs-auth") {
    return (
      <PageShell>
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full">
          {/* Invitation preview */}
          {primaryInvitation && (
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                You've been invited!
              </h2>
              <p className="text-gray-600">
                <strong>
                  {primaryInvitation.metadata?.inviterName || "Someone"}
                </strong>{" "}
                invited you to join{" "}
                <strong>{primaryInvitation.organizationName}</strong> as{" "}
                {primaryInvitation.role === "admin" ? "an" : "a"}{" "}
                <strong>{getRoleDisplayName(primaryInvitation.role)}</strong>.
              </p>
            </div>
          )}

          {/* Auth prompt */}
          <div className="border-t border-gray-200 pt-6">
            <p className="text-sm text-gray-600 text-center mb-4">
              Sign in to accept your invitation
            </p>

            {/* Pre-filled email (read-only) */}
            {primaryInvitation && (
              <div className="mb-4">
                <label className="block text-xs text-gray-500 mb-1">
                  Invited email
                </label>
                <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700">
                  {primaryInvitation.email}
                </div>
              </div>
            )}

            <button
              onClick={handleSignIn}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 hover:border-gray-400 transition-colors"
              data-testid="signin-google-btn"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </button>

            <p className="text-xs text-gray-500 text-center mt-4">
              Please sign in with <strong>{primaryInvitation?.email}</strong>
            </p>
          </div>
        </div>
      </PageShell>
    );
  }

  // Accepting
  if (state === "accepting") {
    return (
      <PageShell>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Joining organisation…</p>
        </div>
      </PageShell>
    );
  }

  // Success
  if (state === "success") {
    const orgNames = allInvitations
      .filter((i) => selectedIds.has(fromBranded(i.id)))
      .map((i) => i.organizationName);

    return (
      <PageShell>
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome!</h2>
          <p className="text-gray-600 mb-4">
            You've joined{" "}
            {orgNames.length === 1
              ? orgNames[0]
              : `${orgNames.length} organisations`}
            .
          </p>
          <p className="text-sm text-gray-500">Redirecting to dashboard…</p>
        </div>
      </PageShell>
    );
  }

  // Error
  if (state === "error") {
    return (
      <PageShell>
        <ErrorCard
          title="Something went wrong"
          message={errorMessage || "Please try again later."}
          showRetry
          onRetry={() => window.location.reload()}
        />
      </PageShell>
    );
  }

  // Show invitation(s) — main acceptance UI
  return (
    <PageShell>
      <div className="bg-white rounded-lg shadow-md p-8 max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-1">
            {allInvitations.length > 1
              ? `You have ${allInvitations.length} pending invitations`
              : "You've been invited!"}
          </h2>
          <p className="text-sm text-gray-500">Signed in as {user?.email}</p>
        </div>

        {/* Error */}
        {errorMessage && (
          <div className="rounded-md bg-red-50 p-3 mb-4">
            <p className="text-sm text-red-700">{errorMessage}</p>
          </div>
        )}

        {/* Invitation list */}
        <div className="space-y-3 mb-6">
          {allInvitations.map((invitation) => {
            const idStr = fromBranded(invitation.id);
            const isSelected = selectedIds.has(idStr);

            return (
              <label
                key={idStr}
                className={`block rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                  isSelected
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleInvitation(invitation.id)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {invitation.organizationName}
                    </div>
                    <div className="text-sm text-gray-500">
                      as {getRoleDisplayName(invitation.role)}
                      {invitation.metadata?.inviterName &&
                        ` · invited by ${invitation.metadata.inviterName}`}
                    </div>
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleDecline}
            className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            disabled={selectedIds.size === 0}
            className="flex-1 rounded-md border border-transparent bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {selectedIds.size === 1
              ? "Accept Invitation"
              : `Accept ${selectedIds.size} Invitations`}
          </button>
        </div>
      </div>
    </PageShell>
  );
}

// ===== Shared UI Components =====

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Project Brayford</h1>
      </div>
      {children}
    </div>
  );
}

function ErrorCard({
  title,
  message,
  showDashboardLink = false,
  showRetry = false,
  onRetry,
}: {
  title: string;
  message: string;
  showDashboardLink?: boolean;
  showRetry?: boolean;
  onRetry?: () => void;
}) {
  const router = useRouter();

  return (
    <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
        <svg
          className="w-6 h-6 text-red-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
      <p className="text-gray-600 mb-6">{message}</p>
      {showDashboardLink && (
        <button
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          Go to Dashboard
        </button>
      )}
      {showRetry && onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

/**
 * Wrap in Suspense because useSearchParams() requires it in Next.js App Router
 */
export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
            <p className="mt-4 text-gray-600">Loading…</p>
          </div>
        </PageShell>
      }
    >
      <JoinPageContent />
    </Suspense>
  );
}
