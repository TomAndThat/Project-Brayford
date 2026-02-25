"use client";

import type { HeaderType } from "@brayford/core";
import type { ImageSlot } from "@/hooks/use-image-upload";
import type { ColorPickerTarget } from "@/hooks/use-color-picker";
import HeaderTypeSelector from "@/components/brands/HeaderTypeSelector";
import ImageUploader from "@/components/brands/ImageUploader";
import ColorPickerField from "@/components/brands/ColorPickerField";

export interface HeaderImageSectionProps {
  headerType: HeaderType;
  onHeaderTypeChange: (type: HeaderType) => void;
  disabled: boolean;

  // Image URLs for each slot
  profileImageUrl?: string;
  logoImageUrl?: string;
  bannerImageUrl?: string;
  headerBackgroundImageUrl?: string;

  // Handlers
  onProfileFileSelected: (file: File) => void;
  onLogoFileSelected: (file: File) => void;
  onBannerFileSelected: (file: File) => void;
  onHeaderBackgroundFileSelected: (file: File) => void;
  onRemoveImage: (slot: ImageSlot) => void;
  onChooseFromLibrary: (slot: ImageSlot) => void;

  // Upload state
  uploading: boolean;
  uploadingSlots: Set<ImageSlot>;
  processingSlots: Set<ImageSlot>;
  uploadError: string | null;

  // Header background colour
  headerBackgroundColor: string;
  onHeaderBackgroundColorChange: (v: string) => void;
  onOpenPicker: (target: ColorPickerTarget) => void;
}

/**
 * Header image section of the brand styling form.
 *
 * Includes the header-type selector, conditional image uploaders,
 * header-background colour picker, and optional background image uploader.
 */
export default function HeaderImageSection({
  headerType,
  onHeaderTypeChange,
  disabled,
  profileImageUrl,
  logoImageUrl,
  bannerImageUrl,
  headerBackgroundImageUrl,
  onProfileFileSelected,
  onLogoFileSelected,
  onBannerFileSelected,
  onHeaderBackgroundFileSelected,
  onRemoveImage,
  onChooseFromLibrary,
  uploading,
  uploadingSlots,
  processingSlots,
  uploadError,
  headerBackgroundColor,
  onHeaderBackgroundColorChange,
  onOpenPicker,
}: HeaderImageSectionProps): React.ReactElement {
  return (
    <>
      {/* Divider + heading */}
      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Header Image
        </h3>
      </div>

      {/* Header Type Selector */}
      <HeaderTypeSelector
        value={headerType}
        onChange={onHeaderTypeChange}
        disabled={disabled}
      />

      {/* Conditional inputs based on selected type */}
      {headerType !== "none" && (
        <div className="space-y-6 border-t border-gray-100 pt-6">
          {/* Profile image */}
          {headerType === "profile" && (
            <ImageUploader
              label="Profile Image"
              helperText="Upload a square image. You'll be able to crop it after selecting."
              currentImageUrl={profileImageUrl}
              onFileSelected={onProfileFileSelected}
              onChooseFromLibrary={() => onChooseFromLibrary("profile")}
              onRemove={() => onRemoveImage("profile")}
              disabled={disabled}
              uploading={uploadingSlots.has("profile")}
              processing={processingSlots.has("profile")}
              error={uploadError}
            />
          )}

          {/* Logo image */}
          {headerType === "logo" && (
            <ImageUploader
              label="Logo Image"
              helperText="Upload your logo in any aspect ratio. It will be centred against the background."
              currentImageUrl={logoImageUrl}
              onFileSelected={onLogoFileSelected}
              onChooseFromLibrary={() => onChooseFromLibrary("logo")}
              onRemove={() => onRemoveImage("logo")}
              disabled={disabled}
              uploading={uploadingSlots.has("logo")}
              processing={processingSlots.has("logo")}
              error={uploadError}
            />
          )}

          {/* Banner image */}
          {headerType === "banner" && (
            <ImageUploader
              label="Banner Image"
              helperText="Upload a wide image. It will span the full width of the audience view."
              currentImageUrl={bannerImageUrl}
              onFileSelected={onBannerFileSelected}
              onChooseFromLibrary={() => onChooseFromLibrary("banner")}
              onRemove={() => onRemoveImage("banner")}
              disabled={disabled}
              uploading={uploadingSlots.has("banner")}
              processing={processingSlots.has("banner")}
              error={uploadError}
            />
          )}

          {/* Header background colour */}
          <div>
            <ColorPickerField
              target="headerBackground"
              label="Header Background Colour"
              helperText={
                headerType === "banner"
                  ? "Visible if your banner has transparency."
                  : "The colour behind your image. Also visible if your image has transparency."
              }
              value={headerBackgroundColor}
              onChange={onHeaderBackgroundColorChange}
              onOpenPicker={onOpenPicker}
              disabled={disabled}
              placeholder="#000000"
            />
          </div>

          {/* Header background image */}
          {(headerType === "profile" ||
            headerType === "logo" ||
            headerType === "banner") && (
            <ImageUploader
              label="Header Background Image (optional)"
              helperText={
                headerType === "banner"
                  ? "An image behind your banner. Visible if the banner has transparency or as a backdrop. Recommended: 1600×1200px or 1920×1080px."
                  : "An image behind your profile/logo. The background colour will show through any transparency. Recommended: 1600×1200px or 1920×1080px."
              }
              currentImageUrl={headerBackgroundImageUrl}
              onFileSelected={onHeaderBackgroundFileSelected}
              onChooseFromLibrary={() =>
                onChooseFromLibrary("header-background")
              }
              onRemove={() => onRemoveImage("header-background")}
              disabled={disabled}
              uploading={uploadingSlots.has("header-background")}
              processing={processingSlots.has("header-background")}
              error={uploadError}
            />
          )}
        </div>
      )}
    </>
  );
}
