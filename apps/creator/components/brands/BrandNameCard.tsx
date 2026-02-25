"use client";

import { useState } from "react";
import { auth } from "@brayford/firebase-utils";
import { useToast } from "@/components/shared/Toast";

export interface BrandNameCardProps {
  brandId: string;
  initialName: string;
  canUpdate: boolean;
  onSaved: () => Promise<void>;
}

/**
 * Card with the brand-name form (name input + save button).
 */
export default function BrandNameCard({
  brandId,
  initialName,
  canUpdate,
  onSaved,
}: BrandNameCardProps): React.ReactElement {
  const { showToast } = useToast();
  const [name, setName] = useState(initialName);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      showToast("Brand name is required", { variant: "error" });
      return;
    }

    if (trimmedName.length > 100) {
      showToast("Brand name must be 100 characters or less", {
        variant: "error",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");

      const response = await fetch(`/api/brands/${brandId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ name: trimmedName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update brand");
      }

      await onSaved();
      showToast("Brand updated successfully", { variant: "success" });
    } catch (err) {
      console.error("Error updating brand:", err);
      showToast(err instanceof Error ? err.message : "Failed to update brand", {
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Brand Name</h2>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Brand Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            disabled={!canUpdate || isSubmitting}
            data-testid="brand-name-input"
          />
          <p className="mt-1 text-xs text-gray-500">
            {name.length}/100 characters
          </p>
        </div>

        {canUpdate && (
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="save-brand-btn"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        )}
      </form>
    </div>
  );
}
