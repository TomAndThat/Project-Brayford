"use client";

import { useState } from "react";
import {
  fromBranded,
  type OrganizationId,
  type OrganizationMemberDocument,
  type BrandDocument,
  type BrandId,
  generateInvitationToken,
  calculateInvitationExpiry,
  type InvitationRole,
  canInviteRole,
} from "@brayford/core";
import {
  createInvitation,
  pendingInvitationExists,
  resendInvitation,
  getOrganizationMembers,
} from "@brayford/firebase-utils";
import { isValidEmail, normalizeEmail } from "@brayford/email-utils";
import OwnerInvitationConfirmDialog from "./OwnerInvitationConfirmDialog";

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: OrganizationId;
  organizationName: string;
  currentMember: OrganizationMemberDocument;
  brands: BrandDocument[];
  onSuccess: () => void;
}

/**
 * Modal for inviting a new user to the organisation
 *
 * Features:
 * - Email input with validation
 * - Role selection (Admin / Member)
 * - Brand access selection (for Members only)
 * - Auto-grant new brands toggle
 * - Duplicate invitation detection
 * - Existing member detection
 */
export default function InviteUserModal({
  isOpen,
  onClose,
  organizationId,
  organizationName,
  currentMember,
  brands,
  onSuccess,
}: InviteUserModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitationRole>("member");
  const [selectedBrands, setSelectedBrands] = useState<BrandId[]>([]);
  const [autoGrantNewBrands, setAutoGrantNewBrands] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showOwnerConfirm, setShowOwnerConfirm] = useState(false);

  // Check if current member can invite owners
  const canInviteOwner = canInviteRole(currentMember, "owner");

  if (!isOpen) return null;

  const handleRoleChange = (newRole: InvitationRole) => {
    setRole(newRole);
    if (newRole === "admin" || newRole === "owner") {
      // Admins and owners get access to all brands
      setSelectedBrands([]);
      setAutoGrantNewBrands(true);
    } else {
      setAutoGrantNewBrands(false);
    }
  };

  const handleToggleBrand = (brandId: BrandId) => {
    setSelectedBrands((prev) =>
      prev.some((id) => fromBranded(id) === fromBranded(brandId))
        ? prev.filter((id) => fromBranded(id) !== fromBranded(brandId))
        : [...prev, brandId],
    );
  };

  const handleSelectAllBrands = () => {
    setSelectedBrands(brands.map((b) => b.id));
  };

  const handleDeselectAllBrands = () => {
    setSelectedBrands([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // If inviting owner, show confirmation dialog first
    if (role === "owner" && !showOwnerConfirm) {
      setShowOwnerConfirm(true);
      return;
    }

    setIsSubmitting(true);

    try {
      // Validate email
      const normalizedEmail = normalizeEmail(email);
      if (!isValidEmail(normalizedEmail)) {
        setError("Please enter a valid email address.");
        return;
      }

      // Check if user is already a member
      const members = await getOrganizationMembers(organizationId);
      const existingMember = members.find(
        (m) =>
          m.user &&
          (m.user as { email?: string }).email?.toLowerCase() ===
            normalizedEmail,
      );
      if (existingMember) {
        setError(
          "A user with this email is already a member of your organisation.",
        );
        return;
      }

      // Check for existing pending invitation
      const existingInvitation = await pendingInvitationExists(
        normalizedEmail,
        organizationId,
      );
      if (existingInvitation) {
        // Offer to resend
        const shouldResend = window.confirm(
          `A pending invitation already exists for ${normalizedEmail}. Would you like to resend it?`,
        );
        if (shouldResend) {
          await resendInvitation(existingInvitation.id);
          setSuccessMessage(`Invitation resent to ${normalizedEmail}`);
          setTimeout(() => {
            resetForm();
            onSuccess();
            onClose();
          }, 1500);
        }
        return;
      }

      // Determine brand access
      const brandAccess =
        role === "admin" || role === "owner"
          ? []
          : selectedBrands.map((b) => fromBranded(b));

      // Create invitation
      await createInvitation({
        email: normalizedEmail,
        organizationId: fromBranded(organizationId),
        organizationName,
        role,
        brandAccess,
        autoGrantNewBrands:
          role === "admin" || role === "owner" ? true : autoGrantNewBrands,
        invitedBy: fromBranded(currentMember.userId),
        token: generateInvitationToken(),
        expiresAt: calculateInvitationExpiry(),
        metadata: {
          inviterName: currentMember.user
            ? (currentMember.user as { displayName?: string }).displayName ||
              undefined
            : undefined,
          inviterEmail: currentMember.user
            ? (currentMember.user as { email?: string }).email || undefined
            : undefined,
        },
      });

      // TODO: Send invitation email via API route (deferred until email sending is wired to API)
      // For now, the invitation is created in Firestore and can be shared via direct link

      setSuccessMessage(`Invitation sent to ${normalizedEmail}`);
      setTimeout(() => {
        resetForm();
        onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      console.error("Failed to create invitation:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setRole("member");
    setSelectedBrands([]);
    setAutoGrantNewBrands(false);
    setError(null);
    setSuccessMessage(null);
    setShowOwnerConfirm(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleOwnerConfirm = () => {
    setShowOwnerConfirm(false);
    // The form will now actually submit
    handleSubmit({ preventDefault: () => {} } as React.FormEvent);
  };

  const handleOwnerCancel = () => {
    setShowOwnerConfirm(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-lg rounded-lg bg-white shadow-xl">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Invite User
              </h2>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg
                  className="h-5 w-5"
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
              </button>
            </div>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="px-6 py-4 space-y-5">
            {/* Error message */}
            {error && (
              <div className="rounded-md bg-red-50 p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Success message */}
            {successMessage && (
              <div className="rounded-md bg-green-50 p-3">
                <p className="text-sm text-green-700">{successMessage}</p>
              </div>
            )}

            {/* Email */}
            <div>
              <label
                htmlFor="invite-email"
                className="block text-sm font-medium text-gray-700"
              >
                Email address
              </label>
              <input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                required
                disabled={isSubmitting}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 sm:text-sm"
                data-testid="invite-email-input"
              />
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => handleRoleChange("owner")}
                  disabled={isSubmitting || !canInviteOwner}
                  className={`rounded-md border px-4 py-3 text-left transition-colors ${
                    role === "owner"
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                      : "border-gray-300 hover:bg-gray-50"
                  } ${!canInviteOwner ? "opacity-50 cursor-not-allowed" : ""}`}
                  title={
                    !canInviteOwner ? "Only owners can invite other owners" : ""
                  }
                >
                  <div className="text-sm font-medium text-gray-900">Owner</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Full control
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleChange("admin")}
                  disabled={isSubmitting}
                  className={`rounded-md border px-4 py-3 text-left transition-colors ${
                    role === "admin"
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                      : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="text-sm font-medium text-gray-900">Admin</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    All brands, manage team
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleChange("member")}
                  disabled={isSubmitting}
                  className={`rounded-md border px-4 py-3 text-left transition-colors ${
                    role === "member"
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                      : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="text-sm font-medium text-gray-900">
                    Member
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Selected brands only
                  </div>
                </button>
              </div>
            </div>

            {/* Owner Warning Banner */}
            {role === "owner" && (
              <div className="rounded-md bg-amber-50 p-3 border border-amber-200">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-amber-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-amber-800">
                      Warning: Owners have full control
                    </h3>
                    <div className="mt-1 text-sm text-amber-700">
                      Owners can manage billing, remove other owners, delete the
                      account, and access all organisation resources.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Brand Access (Member role only) */}
            {role === "member" && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Brand access
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllBrands}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Select all
                    </button>
                    <span className="text-xs text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={handleDeselectAllBrands}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Deselect all
                    </button>
                  </div>
                </div>

                {brands.length === 0 ? (
                  <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3">
                    <p className="text-sm text-yellow-700">
                      No brands in this organisation yet. The invited member
                      won't have access to any brands until you create one.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto rounded-md border border-gray-200">
                    {brands.map((brand) => {
                      const isSelected = selectedBrands.some(
                        (id) => fromBranded(id) === fromBranded(brand.id),
                      );
                      return (
                        <label
                          key={fromBranded(brand.id)}
                          className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleBrand(brand.id)}
                            disabled={isSubmitting}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-3 text-sm text-gray-700">
                            {brand.name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* Auto-grant toggle */}
                <label className="mt-3 flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoGrantNewBrands}
                    onChange={(e) => setAutoGrantNewBrands(e.target.checked)}
                    disabled={isSubmitting}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-600">
                    Automatically grant access to new brands
                  </span>
                </label>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                data-testid="invite-submit-btn"
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="mr-2 h-4 w-4 animate-spin"
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
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Sending…
                  </>
                ) : (
                  "Send Invitation"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Owner Confirmation Dialog */}
      <OwnerInvitationConfirmDialog
        isOpen={showOwnerConfirm}
        email={email}
        onConfirm={handleOwnerConfirm}
        onCancel={handleOwnerCancel}
      />
    </div>
  );
}
