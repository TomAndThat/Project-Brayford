"use client";

import { useState, useEffect } from "react";
import type { OrganizationMemberWithUser } from "@brayford/firebase-utils";
import type { BrandDocument, OrganizationRole } from "@brayford/core";
import {
  hasPermission,
  BRANDS_CREATE,
  getRoleDisplayName,
  canInviteRole,
} from "@brayford/core";

interface EditMemberModalProps {
  isOpen: boolean;
  member: OrganizationMemberWithUser;
  currentMember: OrganizationMemberWithUser;
  brands: BrandDocument[];
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Modal for editing a member's role and brand access
 *
 * - Allows changing role (based on permissions)
 * - Allows changing brand access for members (disabled for owners/admins)
 * - Shows warning when upgrading to owner role
 */
export default function EditMemberModal({
  isOpen,
  member,
  currentMember,
  brands,
  onClose,
  onSuccess,
}: EditMemberModalProps) {
  const [selectedRole, setSelectedRole] = useState<OrganizationRole>(
    member.role,
  );
  const [selectedBrands, setSelectedBrands] = useState<string[]>(
    member.brandAccess.map(String),
  );
  const [autoGrantNewBrands, setAutoGrantNewBrands] = useState<boolean>(
    member.autoGrantNewBrands ?? false,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens with new member
  useEffect(() => {
    if (isOpen) {
      setSelectedRole(member.role);
      setSelectedBrands(member.brandAccess.map(String));
      setAutoGrantNewBrands(member.autoGrantNewBrands ?? false);
      setError(null);
    }
  }, [isOpen, member]);

  if (!isOpen) return null;

  const isActorOwner = hasPermission(currentMember, BRANDS_CREATE);

  // Check if the selected role will have all-brand access
  const selectedRoleHasAllBrandAccess =
    selectedRole === "owner" || selectedRole === "admin";

  // Show warning when upgrading to owner
  const isUpgradingToOwner =
    selectedRole === "owner" && member.role !== "owner";

  // Determine which roles the current user can assign
  const availableRoles: OrganizationRole[] = [];
  if (canInviteRole(currentMember, "owner")) {
    availableRoles.push("owner", "admin", "member");
  } else if (canInviteRole(currentMember, "admin")) {
    availableRoles.push("admin", "member");
  } else {
    availableRoles.push("member");
  }

  // Handle role change — when downgrading to member, pre-select all brands
  const handleRoleChange = (newRole: OrganizationRole) => {
    const previousRole = selectedRole;
    setSelectedRole(newRole);

    if (
      newRole === "member" &&
      (previousRole === "owner" || previousRole === "admin")
    ) {
      // Downgrading to member: preserve access by selecting all brands
      setSelectedBrands(brands.map((b) => String(b.id)));
      setAutoGrantNewBrands(false);
    } else if (newRole === "owner" || newRole === "admin") {
      // Upgrading to owner/admin: auto-grant is implicit, reset
      setAutoGrantNewBrands(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const auth = await import("@brayford/firebase-utils").then((m) => m.auth);
      const idToken = await auth.currentUser?.getIdToken();

      if (!idToken) {
        throw new Error("Not authenticated");
      }

      const { fromBranded } = await import("@brayford/core");

      const response = await fetch(
        `/api/organizations/${fromBranded(member.organizationId)}/members/${fromBranded(member.id)}/role`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            role: selectedRole !== member.role ? selectedRole : undefined,
            brandAccess:
              JSON.stringify(selectedBrands.sort()) !==
              JSON.stringify(member.brandAccess.map(String).sort())
                ? selectedBrands
                : undefined,
            autoGrantNewBrands:
              autoGrantNewBrands !== (member.autoGrantNewBrands ?? false)
                ? autoGrantNewBrands
                : undefined,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update member");
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error("Error updating member:", err);
      setError(err instanceof Error ? err.message : "Failed to update member");
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasChanges =
    selectedRole !== member.role ||
    JSON.stringify(selectedBrands.sort()) !==
      JSON.stringify(member.brandAccess.map(String).sort()) ||
    autoGrantNewBrands !== (member.autoGrantNewBrands ?? false);

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md rounded-lg bg-white shadow-xl">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Edit Team Member
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
                disabled={isSubmitting}
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
          <div className="px-6 py-4 space-y-4">
            {/* Member Info */}
            <div>
              <p className="text-sm font-medium text-gray-700">
                {member.user?.displayName || "Unknown User"}
              </p>
              <p className="text-sm text-gray-500">{member.user?.email}</p>
            </div>

            {/* Role Selector */}
            <div>
              <label
                htmlFor="role"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Role
              </label>
              <select
                id="role"
                value={selectedRole}
                onChange={(e) =>
                  handleRoleChange(e.target.value as OrganizationRole)
                }
                disabled={isSubmitting}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                {availableRoles.map((role) => (
                  <option key={role} value={role}>
                    {getRoleDisplayName(role)}
                  </option>
                ))}
              </select>
            </div>

            {/* Owner Upgrade Warning */}
            {isUpgradingToOwner && (
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
                    <p className="text-sm text-amber-800">
                      <strong>Warning:</strong> This user will have full control
                      over the organisation, including the ability to remove you
                      and access all billing information.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Brand Access */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Brand Access
              </label>

              {selectedRoleHasAllBrandAccess ? (
                <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
                  <p className="text-sm text-gray-600 italic">
                    This role has access to all brands
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-300 rounded-md p-3">
                    {brands.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">
                        No brands available
                      </p>
                    ) : (
                      brands.map((brand) => (
                        <label
                          key={brand.id}
                          className="flex items-center space-x-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedBrands.includes(String(brand.id))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedBrands([
                                  ...selectedBrands,
                                  String(brand.id),
                                ]);
                              } else {
                                setSelectedBrands(
                                  selectedBrands.filter(
                                    (id) => id !== String(brand.id),
                                  ),
                                );
                              }
                            }}
                            disabled={isSubmitting}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">
                            {brand.name}
                          </span>
                        </label>
                      ))
                    )}
                  </div>

                  {/* Auto-grant new brands toggle */}
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
                </>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-md bg-red-50 p-3 border border-red-200">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4">
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !hasChanges}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="confirm-edit-member-btn"
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
