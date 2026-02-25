"use client";

import { useState } from "react";
import { auth } from "@brayford/firebase-utils";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/shared/Toast";
import ArchiveBrandDialog from "@/components/brands/ArchiveBrandDialog";

export interface DangerZoneCardProps {
  brandId: string;
  brandName: string;
  organizationName: string;
  isActive: boolean;
  canDelete: boolean;
}

/**
 * Danger zone card: archive button (when active) or archived notice.
 */
export default function DangerZoneCard({
  brandId,
  brandName,
  organizationName,
  isActive,
  canDelete,
}: DangerZoneCardProps): React.ReactElement | null {
  const router = useRouter();
  const { showToast } = useToast();
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleArchive = async () => {
    setIsArchiving(true);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");

      const response = await fetch(`/api/brands/${brandId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to archive brand");
      }

      showToast("Brand archived successfully", { variant: "success" });
      setTimeout(() => router.push("/dashboard/brands"), 2000);
    } catch (err) {
      console.error("Error archiving brand:", err);
      showToast(
        err instanceof Error ? err.message : "Failed to archive brand",
        { variant: "error" },
      );
    } finally {
      setIsArchiving(false);
      setIsDialogOpen(false);
    }
  };

  // Show archive button when active + user has permission
  if (canDelete && isActive) {
    return (
      <>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-red-900 mb-6">Danger Zone</h2>
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-red-900">
                  Archive this brand
                </p>
                <p className="text-sm text-red-700 mt-1">
                  This will hide the brand from your organisation. You can
                  reactivate it later.
                </p>
              </div>
              <button
                onClick={() => setIsDialogOpen(true)}
                className="ml-4 inline-flex items-center px-3 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                data-testid="archive-brand-btn"
              >
                Archive Brand
              </button>
            </div>
          </div>
        </div>

        <ArchiveBrandDialog
          isOpen={isDialogOpen}
          onCancel={() => setIsDialogOpen(false)}
          onConfirm={handleArchive}
          brandName={brandName}
          organizationName={organizationName}
          isArchiving={isArchiving}
        />
      </>
    );
  }

  // Show archived notice when inactive
  if (!isActive) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="bg-gray-100 border border-gray-300 rounded-md p-4">
          <p className="text-sm font-medium text-gray-900">
            This brand is archived
          </p>
          <p className="text-sm text-gray-700 mt-1">
            Archived brands are hidden from your organisation but can be
            reactivated.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
