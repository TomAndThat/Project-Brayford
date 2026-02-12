"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { HexColorPicker } from "react-colorful";
import { useAuth } from "@/hooks/use-auth";
import {
  getUserOrganizations,
  getBrand,
  getOrganization,
  auth,
  uploadBrandImage,
  deleteBrandImage,
} from "@brayford/firebase-utils";
import {
  toBranded,
  fromBranded,
  type UserId,
  type BrandId,
  type BrandDocument,
  type OrganizationDocument,
  type OrganizationMemberDocument,
  type HeaderType,
  hasPermission,
  BRANDS_UPDATE,
  BRANDS_DELETE,
  validateBackgroundColor,
  DEFAULT_AUDIENCE_BACKGROUND,
} from "@brayford/core";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import ArchiveBrandDialog from "@/components/brands/ArchiveBrandDialog";
import HeaderTypeSelector from "@/components/brands/HeaderTypeSelector";
import ImageUploader from "@/components/brands/ImageUploader";
import CropModal from "@/components/brands/CropModal";
import BrandPreview from "@/components/brands/BrandPreview";

export default function BrandSettingsPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const params = useParams();
  const brandId = params?.brandId as string;

  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState<BrandDocument | null>(null);
  const [organization, setOrganization] = useState<OrganizationDocument | null>(
    null,
  );
  const [currentMember, setCurrentMember] =
    useState<OrganizationMemberDocument | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [backgroundColor, setBackgroundColor] = useState(
    DEFAULT_AUDIENCE_BACKGROUND,
  );
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [activeColorPicker, setActiveColorPicker] = useState<
    "background" | "text" | "headerBackground" | null
  >(null);

  // Header styling state
  const [headerType, setHeaderType] = useState<HeaderType>("none");
  const [profileImageUrl, setProfileImageUrl] = useState<string | undefined>();
  const [logoImageUrl, setLogoImageUrl] = useState<string | undefined>();
  const [bannerImageUrl, setBannerImageUrl] = useState<string | undefined>();
  const [headerBackgroundColor, setHeaderBackgroundColor] = useState("#000000");
  const [headerBackgroundImageUrl, setHeaderBackgroundImageUrl] = useState<
    string | undefined
  >();

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Crop modal state
  const [cropFile, setCropFile] = useState<File | null>(null);

  const loadBrandData = useCallback(async () => {
    if (!user || !brandId) return;

    try {
      const userId = toBranded<UserId>(user.uid);
      const memberships = await getUserOrganizations(userId);

      if (memberships.length === 0) {
        router.push("/onboarding");
        return;
      }

      const currentMembership = memberships[0]!;
      setCurrentMember(currentMembership);

      // Load organization
      const orgId = currentMembership.organizationId;
      const org = await getOrganization(orgId);

      if (!org) {
        alert("Organisation not found");
        router.push("/dashboard");
        return;
      }

      setOrganization(org);

      // Load brand
      const brandData = await getBrand(toBranded<BrandId>(brandId));

      if (!brandData) {
        alert("Brand not found");
        router.push("/dashboard/brands");
        return;
      }

      setBrand(brandData);
      setName(brandData.name);
      setBackgroundColor(
        brandData.styling?.backgroundColor || DEFAULT_AUDIENCE_BACKGROUND,
      );
      setTextColor(brandData.styling?.textColor || "#FFFFFF");
      setHeaderType(brandData.styling?.headerType || "none");
      setProfileImageUrl(brandData.styling?.profileImageUrl);
      setLogoImageUrl(brandData.styling?.logoImageUrl);
      setBannerImageUrl(brandData.styling?.bannerImageUrl);
      setHeaderBackgroundColor(
        brandData.styling?.headerBackgroundColor || "#000000",
      );
      setHeaderBackgroundImageUrl(brandData.styling?.headerBackgroundImageUrl);
    } catch (error) {
      console.error("Error loading brand data:", error);
      alert("Failed to load brand");
      router.push("/dashboard/brands");
    } finally {
      setLoading(false);
    }
  }, [user, brandId, router]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/signin");
      return;
    }

    if (user) {
      loadBrandData();
    }
  }, [user, authLoading, router, loadBrandData]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/signin");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNotification({
        type: "error",
        message: "Brand name is required",
      });
      setTimeout(() => setNotification(null), 5000);
      return;
    }

    if (trimmedName.length > 100) {
      setNotification({
        type: "error",
        message: "Brand name must be 100 characters or less",
      });
      setTimeout(() => setNotification(null), 5000);
      return;
    }

    setIsSubmitting(true);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");

      const updateData = {
        name: trimmedName,
      };

      const response = await fetch(`/api/brands/${brandId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update brand");
      }

      // Reload brand data
      await loadBrandData();

      setNotification({
        type: "success",
        message: "Brand updated successfully",
      });
      setTimeout(() => setNotification(null), 5000);
    } catch (err) {
      console.error("Error updating brand:", err);
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to update brand",
      });
      setTimeout(() => setNotification(null), 7000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStylingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");

      const updateData = {
        styling: {
          backgroundColor,
          textColor,
          headerType,
          profileImageUrl: profileImageUrl || null,
          logoImageUrl: logoImageUrl || null,
          bannerImageUrl: bannerImageUrl || null,
          headerBackgroundColor,
          headerBackgroundImageUrl: headerBackgroundImageUrl || null,
        },
      };

      const response = await fetch(`/api/brands/${brandId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update brand styling");
      }

      // Reload brand data
      await loadBrandData();

      setNotification({
        type: "success",
        message: "Brand styling updated successfully",
      });
      setTimeout(() => setNotification(null), 5000);
    } catch (err) {
      console.error("Error updating brand styling:", err);
      setNotification({
        type: "error",
        message:
          err instanceof Error ? err.message : "Failed to update brand styling",
      });
      setTimeout(() => setNotification(null), 7000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // === Image upload handlers ===

  const handleImageUpload = async (
    file: File | Blob,
    imageType: "profile" | "logo" | "banner" | "header-background",
  ) => {
    if (!brandId) return;
    setUploading(true);
    setUploadError(null);

    try {
      const result = await uploadBrandImage(brandId, file, imageType);

      switch (imageType) {
        case "profile":
          setProfileImageUrl(result.url);
          break;
        case "logo":
          setLogoImageUrl(result.url);
          break;
        case "banner":
          setBannerImageUrl(result.url);
          break;
        case "header-background":
          setHeaderBackgroundImageUrl(result.url);
          break;
      }
    } catch (err) {
      console.error("Upload failed:", err);
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleProfileFileSelected = (file: File) => {
    // Open crop modal for profile images (enforce square)
    setCropFile(file);
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setCropFile(null);
    // Attach the original file's type to the blob
    const blobWithType = new Blob([croppedBlob], {
      type: cropFile?.type || "image/png",
    });
    await handleImageUpload(blobWithType as File, "profile");
  };

  const handleLogoFileSelected = async (file: File) => {
    await handleImageUpload(file, "logo");
  };

  const handleBannerFileSelected = async (file: File) => {
    await handleImageUpload(file, "banner");
  };

  const handleHeaderBackgroundFileSelected = async (file: File) => {
    await handleImageUpload(file, "header-background");
  };

  const handleRemoveImage = async (
    currentUrl: string | undefined,
    setter: (url: string | undefined) => void,
  ) => {
    if (currentUrl) {
      try {
        await deleteBrandImage(currentUrl);
      } catch (err) {
        console.error("Failed to delete image:", err);
        // Continue with removal from state even if storage delete fails
      }
    }
    setter(undefined);
  };

  const handleArchive = async () => {
    setIsArchiving(true);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");

      const response = await fetch(`/api/brands/${brandId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to archive brand");
      }

      setNotification({
        type: "success",
        message: "Brand archived successfully",
      });
      setTimeout(() => {
        router.push("/dashboard/brands");
      }, 2000);
    } catch (err) {
      console.error("Error archiving brand:", err);
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to archive brand",
      });
      setTimeout(() => setNotification(null), 7000);
    } finally {
      setIsArchiving(false);
      setIsArchiveDialogOpen(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user || !brand || !currentMember) {
    return null;
  }

  // Check permissions
  const canUpdate = hasPermission(currentMember, BRANDS_UPDATE);
  const canDelete = hasPermission(currentMember, BRANDS_DELETE);

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        user={user}
        organizationName={brand.name}
        onSignOut={handleSignOut}
        currentMember={currentMember}
        pageTitle="Brand Settings"
        breadcrumb={{
          label: "Back to Brands",
          onClick: () => router.push("/dashboard/brands"),
        }}
      />

      {/* Notification Banner */}
      {notification && (
        <div
          className={`fixed top-20 right-4 z-50 max-w-md rounded-lg shadow-lg p-4 ${
            notification.type === "success"
              ? "bg-green-50 border border-green-200"
              : "bg-red-50 border border-red-200"
          }`}
        >
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {notification.type === "success" ? (
                <svg
                  className="h-5 w-5 text-green-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5 text-red-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
            <div className="ml-3 flex-1">
              <p
                className={`text-sm font-medium ${
                  notification.type === "success"
                    ? "text-green-800"
                    : "text-red-800"
                }`}
              >
                {notification.message}
              </p>
            </div>
            <button
              onClick={() => setNotification(null)}
              className={`ml-3 inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                notification.type === "success"
                  ? "text-green-500 hover:bg-green-100 focus:ring-green-600"
                  : "text-red-500 hover:bg-red-100 focus:ring-red-600"
              }`}
            >
              <span className="sr-only">Dismiss</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          {/* Brand Name Card */}
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

          {/* Brand Styling Card with Preview */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              Brand Styling
            </h2>

            <form onSubmit={handleStylingSubmit}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column - Controls */}
                <div className="space-y-6">
                  {/* Background Color */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Background Colour
                    </label>
                    <p className="text-xs text-gray-500 mb-3">
                      This colour will be applied as the background in the
                      audience app.
                    </p>

                    <div className="flex gap-3 items-start">
                      {/* Clickable Color Preview */}
                      <button
                        type="button"
                        onClick={() => setActiveColorPicker("background")}
                        className="flex-shrink-0 w-16 h-16 rounded-md border-2 border-gray-300 shadow-sm hover:border-blue-400 hover:shadow-md transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 group relative"
                        style={{ backgroundColor }}
                        disabled={!canUpdate || isSubmitting}
                        title="Click to open colour picker"
                      >
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-20 rounded">
                          <svg
                            className="w-6 h-6 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                        </div>
                      </button>

                      {/* Hex Input */}
                      <div className="flex-1">
                        <label
                          htmlFor="hex-input"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Hex Colour Code
                        </label>
                        <input
                          type="text"
                          id="hex-input"
                          value={backgroundColor}
                          onChange={(e) => {
                            const value = e.target.value.trim();
                            // Allow typing, validate on blur or when complete
                            if (value.match(/^#[0-9A-Fa-f]{0,6}$/)) {
                              setBackgroundColor(value.toUpperCase());
                            }
                          }}
                          onBlur={(e) => {
                            const value = e.target.value.trim().toUpperCase();
                            // If incomplete or invalid, revert to previous valid value
                            if (!value.match(/^#[0-9A-Fa-f]{6}$/)) {
                              setBackgroundColor(backgroundColor);
                            }
                          }}
                          maxLength={7}
                          placeholder="#0A0A0A"
                          className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 font-mono text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 uppercase"
                          disabled={!canUpdate || isSubmitting}
                        />
                      </div>
                    </div>

                    {/* Warnings */}
                    {(() => {
                      // Only validate if both colors are complete hex codes
                      const isBackgroundComplete = /^#[0-9A-Fa-f]{6}$/.test(
                        backgroundColor,
                      );
                      const isTextComplete = /^#[0-9A-Fa-f]{6}$/.test(
                        textColor,
                      );

                      if (!isBackgroundComplete || !isTextComplete) {
                        return null;
                      }

                      const validation = validateBackgroundColor(
                        backgroundColor,
                        textColor,
                      );
                      if (validation.warnings.length === 0) {
                        return null;
                      }

                      return (
                        <div className="space-y-2 mt-3">
                          {validation.brightness.toobrightForTheatre && (
                            <div className="rounded-md bg-amber-50 p-3 border border-amber-200">
                              <div className="flex">
                                <svg
                                  className="h-5 w-5 text-amber-400 flex-shrink-0"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                <p className="ml-3 text-sm text-amber-800">
                                  This colour is quite bright. For
                                  theatre/auditorium use, consider a darker
                                  colour to minimise light pollution.
                                </p>
                              </div>
                            </div>
                          )}
                          {!validation.contrast.meetsStandard && (
                            <div className="rounded-md bg-red-50 p-3 border border-red-200">
                              <div className="flex">
                                <svg
                                  className="h-5 w-5 text-red-400 flex-shrink-0"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                <p className="ml-3 text-sm text-red-800">
                                  Low contrast (
                                  {validation.contrast.ratio.toFixed(2)}:1).
                                  White text may be hard to read. WCAG AA
                                  requires 4.5:1.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Text Color */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Text Colour
                    </label>
                    <p className="text-xs text-gray-500 mb-3">
                      This colour will be applied to text in the audience app.
                    </p>

                    <div className="flex gap-3 items-start">
                      {/* Clickable Color Preview */}
                      <button
                        type="button"
                        onClick={() => setActiveColorPicker("text")}
                        className="flex-shrink-0 w-16 h-16 rounded-md border-2 border-gray-300 shadow-sm hover:border-blue-400 hover:shadow-md transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 group relative"
                        style={{ backgroundColor: textColor }}
                        disabled={!canUpdate || isSubmitting}
                        title="Click to open colour picker"
                      >
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-20 rounded">
                          <svg
                            className="w-6 h-6 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                        </div>
                      </button>

                      {/* Hex Input */}
                      <div className="flex-1">
                        <label
                          htmlFor="text-hex-input"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Hex Colour Code
                        </label>
                        <input
                          type="text"
                          id="text-hex-input"
                          value={textColor}
                          onChange={(e) => {
                            const value = e.target.value.trim();
                            // Allow typing, validate on blur or when complete
                            if (value.match(/^#[0-9A-Fa-f]{0,6}$/)) {
                              setTextColor(value.toUpperCase());
                            }
                          }}
                          onBlur={(e) => {
                            const value = e.target.value.trim().toUpperCase();
                            // If incomplete or invalid, revert to previous valid value
                            if (!value.match(/^#[0-9A-Fa-f]{6}$/)) {
                              setTextColor(textColor);
                            }
                          }}
                          maxLength={7}
                          placeholder="#FFFFFF"
                          className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 font-mono text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 uppercase"
                          disabled={!canUpdate || isSubmitting}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Header Image
                    </h3>
                  </div>

                  {/* Header Type Selector */}
                  <HeaderTypeSelector
                    value={headerType}
                    onChange={setHeaderType}
                    disabled={!canUpdate || isSubmitting}
                  />

                  {/* Conditional header inputs based on selected type */}
                  {headerType !== "none" && (
                    <div className="space-y-6 border-t border-gray-100 pt-6">
                      {/* Profile image upload (profile mode) */}
                      {headerType === "profile" && (
                        <ImageUploader
                          label="Profile Image"
                          helperText="Upload a square image. You'll be able to crop it after selecting."
                          currentImageUrl={profileImageUrl}
                          onFileSelected={handleProfileFileSelected}
                          onRemove={() =>
                            handleRemoveImage(
                              profileImageUrl,
                              setProfileImageUrl,
                            )
                          }
                          disabled={!canUpdate || isSubmitting}
                          uploading={uploading}
                          error={uploadError}
                        />
                      )}

                      {/* Logo image upload (logo mode) */}
                      {headerType === "logo" && (
                        <ImageUploader
                          label="Logo Image"
                          helperText="Upload your logo in any aspect ratio. It will be centred against the background."
                          currentImageUrl={logoImageUrl}
                          onFileSelected={handleLogoFileSelected}
                          onRemove={() =>
                            handleRemoveImage(logoImageUrl, setLogoImageUrl)
                          }
                          disabled={!canUpdate || isSubmitting}
                          uploading={uploading}
                          error={uploadError}
                        />
                      )}

                      {/* Banner image upload (banner mode) */}
                      {headerType === "banner" && (
                        <ImageUploader
                          label="Banner Image"
                          helperText="Upload a wide image. It will span the full width of the audience view."
                          currentImageUrl={bannerImageUrl}
                          onFileSelected={handleBannerFileSelected}
                          onRemove={() =>
                            handleRemoveImage(bannerImageUrl, setBannerImageUrl)
                          }
                          disabled={!canUpdate || isSubmitting}
                          uploading={uploading}
                          error={uploadError}
                        />
                      )}

                      {/* Header background colour (all modes) */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Header Background Colour
                        </label>
                        <p className="text-xs text-gray-500 mb-3">
                          {headerType === "banner"
                            ? "Visible if your banner has transparency."
                            : "The colour behind your image. Also visible if your image has transparency."}
                        </p>

                        <div className="flex gap-3 items-start">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveColorPicker("headerBackground")
                            }
                            className="flex-shrink-0 w-16 h-16 rounded-md border-2 border-gray-300 shadow-sm hover:border-blue-400 hover:shadow-md transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 group relative"
                            style={{ backgroundColor: headerBackgroundColor }}
                            disabled={!canUpdate || isSubmitting}
                            title="Click to open colour picker"
                          >
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-20 rounded">
                              <svg
                                className="w-6 h-6 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                />
                              </svg>
                            </div>
                          </button>
                          <div className="flex-1">
                            <label
                              htmlFor="header-bg-hex-input"
                              className="block text-sm font-medium text-gray-700 mb-1"
                            >
                              Hex Colour Code
                            </label>
                            <input
                              type="text"
                              id="header-bg-hex-input"
                              value={headerBackgroundColor}
                              onChange={(e) => {
                                const value = e.target.value.trim();
                                if (value.match(/^#[0-9A-Fa-f]{0,6}$/)) {
                                  setHeaderBackgroundColor(value.toUpperCase());
                                }
                              }}
                              onBlur={(e) => {
                                const value = e.target.value
                                  .trim()
                                  .toUpperCase();
                                if (!value.match(/^#[0-9A-Fa-f]{6}$/)) {
                                  setHeaderBackgroundColor(
                                    headerBackgroundColor,
                                  );
                                }
                              }}
                              maxLength={7}
                              placeholder="#000000"
                              className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 font-mono text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 uppercase"
                              disabled={!canUpdate || isSubmitting}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Header background image (all header modes) */}
                      {(headerType === "profile" ||
                        headerType === "logo" ||
                        headerType === "banner") && (
                        <ImageUploader
                          label="Header Background Image (optional)"
                          helperText={
                            headerType === "banner"
                              ? "An image behind your banner. Visible if the banner has transparency or as a backdrop."
                              : "An image behind your profile/logo. The background colour will show through any transparency."
                          }
                          currentImageUrl={headerBackgroundImageUrl}
                          onFileSelected={handleHeaderBackgroundFileSelected}
                          onRemove={() =>
                            handleRemoveImage(
                              headerBackgroundImageUrl,
                              setHeaderBackgroundImageUrl,
                            )
                          }
                          disabled={!canUpdate || isSubmitting}
                          uploading={uploading}
                          error={uploadError}
                        />
                      )}
                    </div>
                  )}

                  {/* Save Button */}
                  {canUpdate && (
                    <div className="pt-4 border-t border-gray-200">
                      <button
                        type="submit"
                        disabled={isSubmitting || uploading}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? "Saving..." : "Save Styling"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Right Column - Preview */}
                <div className="flex items-start justify-center">
                  <BrandPreview
                    backgroundColor={backgroundColor}
                    textColor={textColor}
                    headerType={headerType}
                    profileImageUrl={profileImageUrl}
                    logoImageUrl={logoImageUrl}
                    bannerImageUrl={bannerImageUrl}
                    headerBackgroundColor={headerBackgroundColor}
                    headerBackgroundImageUrl={headerBackgroundImageUrl}
                  />
                </div>
              </div>
            </form>
          </div>

          {/* Danger Zone Card */}
          {canDelete && brand.isActive && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-red-900 mb-6">
                Danger Zone
              </h2>
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
                    onClick={() => setIsArchiveDialogOpen(true)}
                    className="ml-4 inline-flex items-center px-3 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    data-testid="archive-brand-btn"
                  >
                    Archive Brand
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Archived Notice */}
          {!brand.isActive && (
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
          )}
        </div>
      </main>

      {/* Color Picker Popover */}
      {activeColorPicker && (
        <>
          {/* Backdrop to close on click outside */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setActiveColorPicker(null)}
          />
          {/* Popover */}
          <div className="fixed left-1/4 top-1/2 -translate-y-1/2 z-50 bg-white rounded-lg shadow-2xl p-4 border border-gray-200 max-w-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900">
                {activeColorPicker === "background"
                  ? "Background Colour"
                  : activeColorPicker === "text"
                    ? "Text Colour"
                    : "Header Background Colour"}
              </h3>
              <button
                onClick={() => setActiveColorPicker(null)}
                className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-1"
              >
                <svg
                  className="w-4 h-4"
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

            <div className="flex justify-center mb-3">
              <HexColorPicker
                color={
                  activeColorPicker === "background"
                    ? backgroundColor
                    : activeColorPicker === "text"
                      ? textColor
                      : headerBackgroundColor
                }
                onChange={
                  activeColorPicker === "background"
                    ? setBackgroundColor
                    : activeColorPicker === "text"
                      ? setTextColor
                      : setHeaderBackgroundColor
                }
                style={{
                  width: "220px",
                  height: "160px",
                }}
              />
            </div>

            <div className="text-center">
              <p className="text-xs font-medium text-gray-700 mb-1">
                Selected Colour
              </p>
              <p className="text-sm font-mono text-gray-900">
                {activeColorPicker === "background"
                  ? backgroundColor
                  : activeColorPicker === "text"
                    ? textColor
                    : headerBackgroundColor}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Crop Modal (for profile images) */}
      {cropFile && (
        <CropModal
          imageFile={cropFile}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropFile(null)}
        />
      )}

      {/* Archive Brand Dialog */}
      {brand && organization && (
        <ArchiveBrandDialog
          isOpen={isArchiveDialogOpen}
          onCancel={() => setIsArchiveDialogOpen(false)}
          onConfirm={handleArchive}
          brandName={brand.name}
          organizationName={organization.name}
          isArchiving={isArchiving}
        />
      )}
    </div>
  );
}
