"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useImageDetailData } from "@/hooks/use-image-detail-data";
import { useImageForm } from "@/hooks/use-image-form";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardLayoutWrapper from "@/components/dashboard/DashboardLayoutWrapper";
import ImagePreview from "@/components/images/ImagePreview";
import ImageMetadataForm from "@/components/images/ImageMetadataForm";
import ImageDangerZone from "@/components/images/ImageDangerZone";
import ImageUsageList from "@/components/images/ImageUsageList";

export default function ImageDetailPage({
  params,
}: {
  params: Promise<{ imageId: string }>;
}) {
  const router = useRouter();
  const [imageId, setImageId] = useState<string>("");

  // Resolve async params
  useEffect(() => {
    params.then(({ imageId: id }) => setImageId(id));
  }, [params]);

  const {
    user,
    loading,
    organization,
    currentMember,
    image,
    setImage,
    canEdit,
    canDelete,
    handleSignOut,
  } = useImageDetailData(imageId);

  const form = useImageForm(image, canEdit, setImage);

  // ── Loading / guard states ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user || !organization || !currentMember || !image) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Image not found</div>
      </div>
    );
  }

  return (
    <DashboardLayoutWrapper organizationName={organization.name}>
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader
          user={user}
          organizationName={organization.name}
          onSignOut={handleSignOut}
          currentMember={currentMember}
          pageTitle="Image Details"
        />

        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Back link */}
          <button
            onClick={() => router.push("/dashboard/images")}
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
          >
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Image Library
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Image Preview + File Info */}
            <ImagePreview image={image} />

            {/* Right: Edit Form + Usage + Danger Zone */}
            <div className="space-y-6">
              <ImageMetadataForm canEdit={canEdit} form={form} />

              {/* Used By Section */}
              {(image.usageCount > 0 ||
                image.usedBy.brands.length > 0 ||
                image.usedBy.scenes.length > 0) && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Used By ({image.usageCount})
                  </h3>
                  <ImageUsageList usedBy={image.usedBy} />
                </div>
              )}

              {canDelete && <ImageDangerZone form={form} />}
            </div>
          </div>
        </main>
      </div>
    </DashboardLayoutWrapper>
  );
}
