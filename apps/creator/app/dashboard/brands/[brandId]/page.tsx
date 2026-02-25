"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  fromBranded,
  hasPermission,
  BRANDS_UPDATE,
  BRANDS_DELETE,
} from "@brayford/core";
import { useBrandData } from "@/hooks/use-brand-data";
import { useBrandStylingForm } from "@/hooks/use-brand-styling-form";
import { useImageUpload } from "@/hooks/use-image-upload";
import { useColorPicker } from "@/hooks/use-color-picker";
import type { ImageSlot } from "@/hooks/use-image-upload";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import BrandNameCard from "@/components/brands/BrandNameCard";
import BrandStylingCard from "@/components/brands/BrandStylingCard";
import DangerZoneCard from "@/components/brands/DangerZoneCard";
import ColorPickerPopover from "@/components/brands/ColorPickerPopover";
import CropModal from "@/components/brands/CropModal";
import ImagePickerDialog from "@/components/images/ImagePickerDialog";
import type { ImagePickerSelection } from "@/components/images/ImagePickerDialog";

export default function BrandSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const brandId = params?.brandId as string;

  // ── Data loading & auth ─────────────────────────────────────────────
  const {
    user,
    loading,
    brand,
    organization,
    currentMember,
    reload,
    handleSignOut,
  } = useBrandData(brandId);

  // ── Styling form state ──────────────────────────────────────────────
  const stylingForm = useBrandStylingForm(brand, brandId, reload);

  // ── Image upload ────────────────────────────────────────────────────
  const imageUpload = useImageUpload(
    organization,
    brand?.name,
    stylingForm.imageSlots,
  );

  // ── Colour picker popover ───────────────────────────────────────────
  const colorPicker = useColorPicker(stylingForm.colorEntries);

  // ── Image picker dialog (choose from library) ──────────────────────
  const [imagePickerSlot, setImagePickerSlot] = useState<ImageSlot | null>(
    null,
  );

  const handleImagePickerSelection = (selection: ImagePickerSelection) => {
    if (!imagePickerSlot) return;
    const slot = stylingForm.imageSlots[imagePickerSlot];
    slot.setUrl(selection.url);
    slot.setId(selection.id);
    setImagePickerSlot(null);
  };

  // ── Loading / guard states ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user || !brand || !currentMember) {
    return null;
  }

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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          {/* Brand Name */}
          <BrandNameCard
            brandId={brandId}
            initialName={brand.name}
            canUpdate={canUpdate}
            onSaved={reload}
          />

          {/* Brand Styling */}
          <BrandStylingCard
            backgroundColor={stylingForm.backgroundColor}
            onBackgroundColorChange={stylingForm.setBackgroundColor}
            textColor={stylingForm.textColor}
            onTextColorChange={stylingForm.setTextColor}
            headerType={stylingForm.headerType}
            onHeaderTypeChange={stylingForm.setHeaderType}
            headerBackgroundColor={stylingForm.headerBackgroundColor}
            onHeaderBackgroundColorChange={stylingForm.setHeaderBackgroundColor}
            inputBackgroundColor={stylingForm.inputBackgroundColor}
            onInputBackgroundColorChange={stylingForm.setInputBackgroundColor}
            inputTextColor={stylingForm.inputTextColor}
            onInputTextColorChange={stylingForm.setInputTextColor}
            buttonBackgroundColor={stylingForm.buttonBackgroundColor}
            onButtonBackgroundColorChange={stylingForm.setButtonBackgroundColor}
            buttonTextColor={stylingForm.buttonTextColor}
            onButtonTextColorChange={stylingForm.setButtonTextColor}
            profileImageUrl={stylingForm.imageSlots.profile.url}
            logoImageUrl={stylingForm.imageSlots.logo.url}
            bannerImageUrl={stylingForm.imageSlots.banner.url}
            headerBackgroundImageUrl={
              stylingForm.imageSlots["header-background"].url
            }
            onProfileFileSelected={imageUpload.handleProfileFileSelected}
            onLogoFileSelected={imageUpload.handleLogoFileSelected}
            onBannerFileSelected={imageUpload.handleBannerFileSelected}
            onHeaderBackgroundFileSelected={
              imageUpload.handleHeaderBackgroundFileSelected
            }
            onRemoveImage={imageUpload.handleRemoveImage}
            onChooseFromLibrary={setImagePickerSlot}
            uploading={imageUpload.uploading}
            uploadingSlots={imageUpload.uploadingSlots}
            processingSlots={imageUpload.processingSlots}
            isProcessing={imageUpload.isProcessing}
            uploadError={imageUpload.uploadError}
            onOpenPicker={colorPicker.open}
            canUpdate={canUpdate}
            isSubmitting={stylingForm.isSubmitting}
            onSubmit={stylingForm.handleStylingSubmit}
          />

          {/* Danger Zone / Archived Notice */}
          {organization && (
            <DangerZoneCard
              brandId={brandId}
              brandName={brand.name}
              organizationName={organization.name}
              isActive={brand.isActive}
              canDelete={canDelete}
            />
          )}
        </div>
      </main>

      {/* Colour Picker Popover */}
      {colorPicker.active && (
        <ColorPickerPopover
          label={colorPicker.active.label}
          value={colorPicker.active.value}
          onChange={colorPicker.active.onChange}
          onClose={colorPicker.close}
        />
      )}

      {/* Crop Modal (profile images) */}
      {imageUpload.cropFile && imageUpload.cropImageUrl && (
        <CropModal
          imageUrl={imageUpload.cropImageUrl}
          mimeType={imageUpload.cropFile.type}
          onCropComplete={imageUpload.handleCropComplete}
          onCancel={imageUpload.cleanupCropState}
        />
      )}

      {/* Image Picker Dialog */}
      {imagePickerSlot && organization && (
        <ImagePickerDialog
          organizationId={fromBranded(organization.id)}
          onSelect={handleImagePickerSelection}
          onClose={() => setImagePickerSlot(null)}
        />
      )}
    </div>
  );
}
