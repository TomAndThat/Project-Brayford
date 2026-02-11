"use client";

import { useState } from "react";
import { fromBranded, type OrganizationId } from "@brayford/core";
import { auth } from "@brayford/firebase-utils";

interface CreateBrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: OrganizationId;
  organizationName: string;
  onSuccess: (brandId: string) => void;
}

/**
 * Modal for creating a new brand
 *
 * Features:
 * - Brand name input with validation (1-100 chars)
 * - Creates brand via POST /api/brands
 * - Redirects to brand settings on success
 */
export default function CreateBrandModal({
  isOpen,
  onClose,
  organizationId,
  organizationName,
  onSuccess,
}: CreateBrandModalProps) {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate name
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Brand name is required.");
      return;
    }
    if (trimmedName.length > 100) {
      setError("Brand name must be 100 characters or less.");
      return;
    }

    setIsSubmitting(true);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");

      const response = await fetch("/api/brands", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          organizationId: fromBranded(organizationId),
          name: trimmedName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create brand");
      }

      const data = await response.json();

      // Reset form
      setName("");
      onClose();

      // Call success handler with new brand ID
      onSuccess(data.brandId);
    } catch (err) {
      console.error("Error creating brand:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create brand. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setName("");
      setError(null);
      onClose();
    }
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
                Create New Brand
              </h2>
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="text-gray-400 hover:text-gray-500 disabled:opacity-50"
                type="button"
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
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
            <p className="text-sm text-gray-600">
              Create a brand for {organizationName}.
            </p>

            {/* Error Message */}
            {error && (
              <div className="rounded-md bg-red-50 p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Brand Name Field */}
            <div>
              <label
                htmlFor="brand-name"
                className="block text-sm font-medium text-gray-700"
              >
                Brand Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="brand-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 sm:text-sm"
                placeholder="e.g., The Podcast Show"
                disabled={isSubmitting}
                autoFocus
                data-testid="brand-name-input"
              />
              <p className="mt-1 text-xs text-gray-500">
                {name.length}/100 characters
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="create-brand-cancel"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="create-brand-submit"
              >
                {isSubmitting ? "Creating..." : "Create Brand"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
