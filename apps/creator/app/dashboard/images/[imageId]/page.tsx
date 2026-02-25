"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  getUserOrganizations,
  getOrganization,
  auth,
} from "@brayford/firebase-utils";
import {
  toBranded,
  type UserId,
  type OrganizationDocument,
  type OrganizationMemberDocument,
  hasPermission,
  IMAGES_VIEW,
  IMAGES_UPDATE,
  IMAGES_DELETE,
  MAX_TAGS_PER_IMAGE,
  MAX_TAG_LENGTH,
} from "@brayford/core";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardLayoutWrapper from "@/components/dashboard/DashboardLayoutWrapper";
import ImageUsageList from "@/components/images/ImageUsageList";

interface ImageDetail {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  tags: string[];
  storagePath: string;
  url: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  dimensions: { width: number; height: number };
  uploadStatus: string;
  variants?: { thumbnail: string; display: string };
  usageCount: number;
  usedBy: { brands: string[]; scenes: string[] };
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export default function ImageDetailPage({
  params,
}: {
  params: Promise<{ imageId: string }>;
}) {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<OrganizationDocument | null>(
    null,
  );
  const [currentMember, setCurrentMember] =
    useState<OrganizationMemberDocument | null>(null);
  const [image, setImage] = useState<ImageDetail | null>(null);
  const [imageId, setImageId] = useState<string>("");

  // Edit state
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCascadeConfirm, setShowCascadeConfirm] = useState(false);
  const [cascadeData, setCascadeData] = useState<{
    usedBy: { brands: string[]; scenes: string[] };
    liveEventWarnings: string[];
  } | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Resolve params
  useEffect(() => {
    params.then(({ imageId: id }) => setImageId(id));
  }, [params]);

  const loadUserData = useCallback(async () => {
    if (!user || !imageId) return;

    try {
      const userId = toBranded<UserId>(user.uid);
      const memberships = await getUserOrganizations(userId);

      if (memberships.length === 0) {
        router.push("/onboarding");
        return;
      }

      const currentMembership = memberships[0]!;
      setCurrentMember(currentMembership);

      const org = await getOrganization(currentMembership.organizationId);
      if (!org) {
        router.push("/dashboard");
        return;
      }
      setOrganization(org);

      // Fetch image data directly via GET endpoint
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(`/api/images/${imageId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const imageData = data.image as ImageDetail;
        if (imageData) {
          setImage(imageData);
          setEditName(imageData.name);
          setEditDescription(imageData.description || "");
          setEditTags(imageData.tags || []);
        }
      }
    } catch (error) {
      console.error("Error loading image detail:", error);
    } finally {
      setLoading(false);
    }
  }, [user, router, imageId]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/signin");
      return;
    }
    if (user && imageId) {
      loadUserData();
    }
  }, [user, authLoading, router, loadUserData, imageId]);

  useEffect(() => {
    if (!loading && currentMember && organization) {
      if (!hasPermission(currentMember, IMAGES_VIEW)) {
        router.push("/dashboard");
      }
    }
  }, [loading, currentMember, organization, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/signin");
  };

  const handleSave = async () => {
    if (!image || !currentMember) return;

    if (!hasPermission(currentMember, IMAGES_UPDATE)) {
      setNotification({
        type: "error",
        message: "You do not have permission to update images.",
      });
      return;
    }

    setIsSaving(true);
    setNotification(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(`/api/images/${image.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editName,
          description: editDescription || undefined,
          tags: editTags,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setImage(data.image);
        setNotification({
          type: "success",
          message: "Image updated successfully.",
        });
      } else {
        const errorData = await response.json();
        setNotification({
          type: "error",
          message: errorData.error || "Failed to update image.",
        });
      }
    } catch (error) {
      setNotification({ type: "error", message: "Failed to update image." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (force = false) => {
    if (!image || !currentMember) return;

    setIsDeleting(true);
    setNotification(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      const url = force
        ? `/api/images/${image.id}?force=true`
        : `/api/images/${image.id}`;

      const response = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 204 || response.ok) {
        // If force deletion, show summary
        if (force && response.ok) {
          const data = await response.json();
          const totalRemoved =
            (data.removed?.brands || 0) + (data.removed?.scenes || 0);
          setNotification({
            type: "success",
            message: `Image deleted and removed from ${totalRemoved} ${totalRemoved === 1 ? "item" : "items"}.`,
          });
          setTimeout(() => router.push("/dashboard/images"), 2000);
        } else {
          router.push("/dashboard/images");
        }
        return;
      }

      if (response.status === 409) {
        const data = await response.json();
        // Show cascade confirmation modal
        setCascadeData({
          usedBy: data.usedBy || { brands: [], scenes: [] },
          liveEventWarnings: data.liveEventWarnings || [],
        });
        setShowDeleteConfirm(false);
        setShowCascadeConfirm(true);
      } else {
        const errorData = await response.json();
        setNotification({
          type: "error",
          message: errorData.error || "Failed to delete image.",
        });
      }
    } catch (error) {
      setNotification({ type: "error", message: "Failed to delete image." });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCascadeConfirm = async () => {
    setShowCascadeConfirm(false);
    await handleDelete(true);
  };

  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_TAG_LENGTH) return;
    if (editTags.length >= MAX_TAGS_PER_IMAGE) return;
    if (editTags.includes(trimmed)) return;
    setEditTags([...editTags, trimmed]);
    setNewTag("");
  };

  const handleRemoveTag = (tag: string) => {
    setEditTags(editTags.filter((t) => t !== tag));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatContentType = (type: string): string => {
    const map: Record<string, string> = {
      "image/jpeg": "JPEG",
      "image/png": "PNG",
      "image/webp": "WebP",
      "image/gif": "GIF",
    };
    return map[type] || type;
  };

  if (authLoading || loading) {
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

  const canEdit = hasPermission(currentMember, IMAGES_UPDATE);
  const canDelete = hasPermission(currentMember, IMAGES_DELETE);

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

          {/* Notification */}
          {notification && (
            <div
              className={`mb-6 p-4 rounded-md ${
                notification.type === "success"
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
              }`}
            >
              <p className="text-sm font-medium">{notification.message}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Image Preview */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="aspect-auto max-h-[500px] bg-gray-100 flex items-center justify-center">
                <img
                  src={image.variants?.display ?? image.url}
                  alt={image.name}
                  className="max-w-full max-h-[500px] object-contain"
                />
              </div>

              {/* Read-only info */}
              <div className="p-6 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">
                  File Information
                </h4>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-gray-500">Filename</dt>
                  <dd className="text-gray-900 truncate">{image.filename}</dd>

                  <dt className="text-gray-500">Format</dt>
                  <dd className="text-gray-900">
                    {formatContentType(image.contentType)}
                  </dd>

                  <dt className="text-gray-500">Dimensions</dt>
                  <dd className="text-gray-900">
                    {image.dimensions.width} × {image.dimensions.height} px
                  </dd>

                  <dt className="text-gray-500">File Size</dt>
                  <dd className="text-gray-900">
                    {formatFileSize(image.sizeBytes)}
                  </dd>

                  <dt className="text-gray-500">Uploaded</dt>
                  <dd className="text-gray-900">
                    {image.createdAt
                      ? new Date(image.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </dd>
                </dl>
              </div>
            </div>

            {/* Right: Edit Form + Usage */}
            <div className="space-y-6">
              {/* Metadata Form */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Image Metadata
                </h3>

                {/* Name */}
                <div className="mb-4">
                  <label
                    htmlFor="image-name"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Name
                  </label>
                  <input
                    type="text"
                    id="image-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    disabled={!canEdit}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>

                {/* Description */}
                <div className="mb-4">
                  <label
                    htmlFor="image-description"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Description
                  </label>
                  <textarea
                    id="image-description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    disabled={!canEdit}
                    rows={3}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
                    placeholder="Optional description..."
                  />
                </div>

                {/* Tags */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tags ({editTags.length}/{MAX_TAGS_PER_IMAGE})
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {editTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700"
                      >
                        {tag}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="ml-1 text-blue-400 hover:text-blue-600"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                  {canEdit && editTags.length < MAX_TAGS_PER_IMAGE && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddTag();
                          }
                        }}
                        placeholder="Add a tag..."
                        maxLength={MAX_TAG_LENGTH}
                        className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                      <button
                        type="button"
                        onClick={handleAddTag}
                        className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100"
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>

                {/* Save button */}
                {canEdit && (
                  <button
                    onClick={handleSave}
                    disabled={isSaving || !editName.trim()}
                    className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </button>
                )}
              </div>

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

              {/* Delete Section */}
              {canDelete && (
                <div className="bg-white rounded-lg shadow-md p-6 border border-red-200">
                  <h3 className="text-lg font-semibold text-red-900 mb-2">
                    Danger Zone
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Permanently delete this image from your library. This action
                    cannot be undone.
                  </p>

                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100"
                    >
                      Delete Image
                    </button>
                  ) : (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleDelete(false)}
                        disabled={isDeleting}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-gray-300"
                      >
                        {isDeleting ? "Deleting..." : "Confirm Delete"}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Cascade Delete Confirmation Modal */}
      {showCascadeConfirm && cascadeData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Image In Use
            </h3>

            <div className="mb-4 space-y-3">
              <p className="text-sm text-gray-700">
                This image is currently used by:
              </p>

              {cascadeData.usedBy.brands.length > 0 && (
                <div className="p-3 bg-blue-50 rounded-md">
                  <div className="text-sm font-medium text-blue-900">
                    {cascadeData.usedBy.brands.length}{" "}
                    {cascadeData.usedBy.brands.length === 1
                      ? "Brand"
                      : "Brands"}
                  </div>
                </div>
              )}

              {cascadeData.usedBy.scenes.length > 0 && (
                <div className="p-3 bg-purple-50 rounded-md">
                  <div className="text-sm font-medium text-purple-900">
                    {cascadeData.usedBy.scenes.length}{" "}
                    {cascadeData.usedBy.scenes.length === 1
                      ? "Scene"
                      : "Scenes"}
                  </div>
                </div>
              )}

              {cascadeData.liveEventWarnings.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                  {cascadeData.liveEventWarnings.map((warning, idx) => (
                    <div
                      key={idx}
                      className="text-sm font-medium text-amber-900"
                    >
                      {warning}
                    </div>
                  ))}
                </div>
              )}

              <p className="text-sm text-gray-600 mt-4">
                Deleting this image will remove it from all these items and may
                affect their appearance.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCascadeConfirm(false);
                  setCascadeData(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCascadeConfirm}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-gray-300"
              >
                {isDeleting ? "Deleting..." : "Remove and Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayoutWrapper>
  );
}
