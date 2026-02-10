"use client";

import { useState, useCallback } from "react";
import {
  hasPermission,
  ORG_DELETE,
  type OrganizationDocument,
  type OrganizationMemberDocument,
} from "@brayford/core";

interface DeleteOrganizationSectionProps {
  organization: OrganizationDocument;
  currentMember: OrganizationMemberDocument;
  getIdToken: () => Promise<string>;
}

/**
 * Danger zone section for deleting an organisation.
 *
 * Only visible to users with org:delete permission.
 * Implements multi-step confirmation:
 * 1. Click "Delete Organisation" button
 * 2. Type organisation name to confirm
 * 3. Click "Send Confirmation Email"
 * 4. User receives email with link to confirm deletion
 */
export default function DeleteOrganizationSection({
  organization,
  currentMember,
  getIdToken,
}: DeleteOrganizationSectionProps) {
  const canDelete = hasPermission(currentMember, ORG_DELETE);

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  // Check if there's already a pending deletion request
  const hasPendingDeletion = !!organization.deletionRequestId;

  const nameMatches =
    confirmationText.trim().toLowerCase() ===
    organization.name.trim().toLowerCase();

  const handleInitiateDeletion = useCallback(async () => {
    if (!nameMatches || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const idToken = await getIdToken();

      const response = await fetch(
        `/api/organizations/${organization.id}/delete/initiate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            confirmationName: confirmationText.trim(),
          }),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error || "Failed to initiate deletion. Please try again.",
        );
      }

      setEmailSent(true);
      setShowConfirmation(false);
      setConfirmationText("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    nameMatches,
    isSubmitting,
    organization.id,
    confirmationText,
    getIdToken,
  ]);

  if (!canDelete) {
    return null;
  }

  // Show success message after email is sent
  if (emailSent) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 border-2 border-amber-200">
        <div className="flex items-start space-x-3">
          <svg
            className="h-6 w-6 text-amber-500 mt-0.5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Confirmation Email Sent
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              We&apos;ve sent a confirmation email to your address. You must
              click the link within <strong>24 hours</strong> to proceed with
              the deletion of <strong>{organization.name}</strong>.
            </p>
            <p className="mt-2 text-sm text-gray-500">
              If you did not request this, you can safely ignore the email.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show pending deletion state
  if (hasPendingDeletion) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 border-2 border-amber-200">
        <div className="flex items-start space-x-3">
          <svg
            className="h-6 w-6 text-amber-500 mt-0.5 flex-shrink-0"
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
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Deletion Pending
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              A deletion request is already pending for this organisation.
              Please check your email for the confirmation link, or wait for the
              existing request to expire.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-8 border-2 border-red-200">
      <h3 className="text-lg font-semibold text-red-900 mb-2">Danger Zone</h3>
      <p className="text-sm text-gray-600 mb-4">
        Actions in this section are irreversible and affect your entire
        organisation.
      </p>

      <div className="border-t border-red-100 pt-4">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">
              Delete Organisation
            </h4>
            <p className="text-sm text-gray-500 mt-1 max-w-md">
              Permanently delete <strong>{organization.name}</strong> and all
              associated data, including all brands, events, and member access.
              This action cannot be undone.
            </p>
          </div>

          {!showConfirmation && (
            <button
              onClick={() => setShowConfirmation(true)}
              className="ml-4 inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              data-testid="delete-org-btn"
            >
              Delete Organisation
            </button>
          )}
        </div>

        {/* Confirmation Step */}
        {showConfirmation && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2 mb-3">
              <svg
                className="h-5 w-5 text-red-600"
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
              <span className="text-sm font-semibold text-red-800">
                This is extremely destructive
              </span>
            </div>

            <p className="text-sm text-red-700 mb-4">
              This will permanently delete the organisation{" "}
              <strong>{organization.name}</strong>, including:
            </p>
            <ul className="text-sm text-red-700 mb-4 list-disc list-inside space-y-1">
              <li>All brands and their configurations</li>
              <li>All events and interaction data</li>
              <li>All team member access</li>
              <li>
                User accounts that belong only to this organisation will also be
                deleted
              </li>
            </ul>

            <label
              htmlFor="confirm-org-name"
              className="block text-sm font-medium text-red-800 mb-2"
            >
              Type <strong>{organization.name}</strong> to confirm:
            </label>
            <input
              id="confirm-org-name"
              type="text"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              className="block w-full px-3 py-2 border border-red-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder={organization.name}
              autoComplete="off"
              data-testid="confirm-org-name-input"
            />

            {error && (
              <div className="mt-3 text-sm text-red-600 bg-red-100 p-2 rounded">
                {error}
              </div>
            )}

            <div className="mt-4 flex items-center space-x-3">
              <button
                onClick={handleInitiateDeletion}
                disabled={!nameMatches || isSubmitting}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${
                  nameMatches && !isSubmitting
                    ? "bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    : "bg-red-300 cursor-not-allowed"
                }`}
                data-testid="confirm-delete-btn"
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                    Sending Confirmation Email…
                  </>
                ) : (
                  "Send Confirmation Email"
                )}
              </button>

              <button
                onClick={() => {
                  setShowConfirmation(false);
                  setConfirmationText("");
                  setError(null);
                }}
                disabled={isSubmitting}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                data-testid="cancel-delete-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
