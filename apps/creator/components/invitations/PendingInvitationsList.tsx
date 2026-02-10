"use client";

import { useState } from "react";
import {
  fromBranded,
  type OrganizationId,
  type InvitationDocument,
  isInvitationExpired,
  getRoleDisplayName,
} from "@brayford/core";
import { auth } from "@brayford/firebase-utils";

interface PendingInvitationsListProps {
  invitations: InvitationDocument[];
  organizationId: OrganizationId;
  canManageInvitations: boolean;
  onRefresh: () => void;
}

/**
 * Displays pending invitations in the team members list
 * Shows email, role, invited date, expiry status, and action buttons
 */
export default function PendingInvitationsList({
  invitations,
  canManageInvitations,
  onRefresh,
}: PendingInvitationsListProps) {
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  if (invitations.length === 0) {
    return null;
  }

  const handleResend = async (invitation: InvitationDocument) => {
    setActionInProgress(fromBranded(invitation.id));
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");
      const res = await fetch(
        `/api/invitations/${fromBranded(invitation.id)}/resend`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
        },
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to resend invitation");
      }
      onRefresh();
    } catch (error) {
      console.error("Failed to resend invitation:", error);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleCancel = async (invitation: InvitationDocument) => {
    const confirmed = window.confirm(
      `Cancel the invitation to ${invitation.email}? They will no longer be able to join using the existing link.`,
    );
    if (!confirmed) return;

    setActionInProgress(fromBranded(invitation.id));
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");
      const res = await fetch(
        `/api/invitations/${fromBranded(invitation.id)}/cancel`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
        },
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to cancel invitation");
      }
      onRefresh();
    } catch (error) {
      console.error("Failed to cancel invitation:", error);
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <>
      {invitations.map((invitation) => {
        const expired = isInvitationExpired(invitation);
        const isLoading = actionInProgress === fromBranded(invitation.id);

        return (
          <tr key={fromBranded(invitation.id)} className="bg-gray-50/50">
            {/* User Info (email only, they haven't joined yet) */}
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-gray-400"
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
                </div>
                <div className="ml-4">
                  <div className="text-sm font-medium text-gray-500">
                    {invitation.email}
                  </div>
                  <div className="text-xs text-gray-400">
                    {expired ? (
                      <span className="text-red-500">Invitation expired</span>
                    ) : (
                      <span>
                        Expires{" "}
                        {invitation.expiresAt.toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </td>

            {/* Role */}
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    invitation.role === "admin"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {getRoleDisplayName(invitation.role)}
                </span>
                <span
                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    expired
                      ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {expired ? "Expired" : "Pending"}
                </span>
              </div>
            </td>

            {/* Invited Date */}
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              Invited{" "}
              {invitation.invitedAt.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </td>

            {/* Brand Access */}
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {invitation.role === "admin" ? (
                <span className="text-gray-400 italic">All brands</span>
              ) : invitation.brandAccess.length === 0 ? (
                <span className="text-gray-400 italic">No brands</span>
              ) : (
                <span>
                  {invitation.brandAccess.length} brand
                  {invitation.brandAccess.length !== 1 ? "s" : ""}
                </span>
              )}
            </td>

            {/* Actions */}
            {canManageInvitations && (
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => handleResend(invitation)}
                    disabled={isLoading}
                    className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                  >
                    {isLoading ? "…" : "Resend"}
                  </button>
                  <button
                    onClick={() => handleCancel(invitation)}
                    disabled={isLoading}
                    className="text-red-600 hover:text-red-900 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </td>
            )}
          </tr>
        );
      })}
    </>
  );
}
