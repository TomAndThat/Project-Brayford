"use client";

import { validateBackgroundColor } from "@brayford/core";
import type { HeaderType } from "@brayford/core";
import type { ColorPickerTarget } from "@/hooks/use-color-picker";
import type { ImageSlot } from "@/hooks/use-image-upload";
import ColorPickerField from "@/components/brands/ColorPickerField";
import HeaderImageSection from "@/components/brands/HeaderImageSection";
import InteractiveElementsSection from "@/components/brands/InteractiveElementsSection";
import BrandPreview from "@/components/brands/BrandPreview";

// ────────────────────────────────────────────────────────────────────────────
// Contrast warnings (extracted from inline IIFE)
// ────────────────────────────────────────────────────────────────────────────

function ContrastWarnings({
  backgroundColor,
  textColor,
}: {
  backgroundColor: string;
  textColor: string;
}): React.ReactElement | null {
  const isBackgroundComplete = /^#[0-9A-Fa-f]{6}$/.test(backgroundColor);
  const isTextComplete = /^#[0-9A-Fa-f]{6}$/.test(textColor);

  if (!isBackgroundComplete || !isTextComplete) return null;

  const validation = validateBackgroundColor(backgroundColor, textColor);
  if (validation.warnings.length === 0) return null;

  return (
    <div className="space-y-2 mt-3">
      {validation.brightness.tooBrightForTheatre && (
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
              This colour is quite bright. For theatre/auditorium use, consider
              a darker colour to minimise light pollution.
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
              Low contrast ({validation.contrast.ratio.toFixed(2)}:1). White
              text may be hard to read. WCAG AA requires 4.5:1.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────

export interface BrandStylingCardProps {
  // Page-level colours
  backgroundColor: string;
  onBackgroundColorChange: (v: string) => void;
  textColor: string;
  onTextColorChange: (v: string) => void;

  // Header
  headerType: HeaderType;
  onHeaderTypeChange: (v: HeaderType) => void;
  headerBackgroundColor: string;
  onHeaderBackgroundColorChange: (v: string) => void;

  // Interactive element colours
  inputBackgroundColor: string;
  onInputBackgroundColorChange: (v: string) => void;
  inputTextColor: string;
  onInputTextColorChange: (v: string) => void;
  buttonBackgroundColor: string;
  onButtonBackgroundColorChange: (v: string) => void;
  buttonTextColor: string;
  onButtonTextColorChange: (v: string) => void;

  // Image URLs
  profileImageUrl?: string;
  logoImageUrl?: string;
  bannerImageUrl?: string;
  headerBackgroundImageUrl?: string;

  // Image handlers
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
  isProcessing: boolean;
  uploadError: string | null;

  // Colour picker
  onOpenPicker: (target: ColorPickerTarget) => void;

  // Permissions & form
  canUpdate: boolean;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => Promise<void>;
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

/**
 * Brand styling card containing all colour, header-image, interactive-element,
 * and preview controls. Wraps a `<form>` element.
 */
export default function BrandStylingCard({
  backgroundColor,
  onBackgroundColorChange,
  textColor,
  onTextColorChange,
  headerType,
  onHeaderTypeChange,
  headerBackgroundColor,
  onHeaderBackgroundColorChange,
  inputBackgroundColor,
  onInputBackgroundColorChange,
  inputTextColor,
  onInputTextColorChange,
  buttonBackgroundColor,
  onButtonBackgroundColorChange,
  buttonTextColor,
  onButtonTextColorChange,
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
  isProcessing,
  uploadError,
  onOpenPicker,
  canUpdate,
  isSubmitting,
  onSubmit,
}: BrandStylingCardProps): React.ReactElement {
  const disabled = !canUpdate || isSubmitting;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Brand Styling</h2>

      <form onSubmit={onSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column — Controls */}
          <div className="space-y-6">
            {/* Background Colour */}
            <div>
              <ColorPickerField
                target="background"
                label="Background Colour"
                helperText="This colour will be applied as the background in the audience app."
                value={backgroundColor}
                onChange={onBackgroundColorChange}
                onOpenPicker={onOpenPicker}
                disabled={disabled}
                placeholder="#0A0A0A"
              />
              <ContrastWarnings
                backgroundColor={backgroundColor}
                textColor={textColor}
              />
            </div>

            {/* Text Colour */}
            <ColorPickerField
              target="text"
              label="Text Colour"
              helperText="This colour will be applied to text in the audience app."
              value={textColor}
              onChange={onTextColorChange}
              onOpenPicker={onOpenPicker}
              disabled={disabled}
              placeholder="#FFFFFF"
            />

            {/* Header Image Section */}
            <HeaderImageSection
              headerType={headerType}
              onHeaderTypeChange={onHeaderTypeChange}
              disabled={disabled}
              profileImageUrl={profileImageUrl}
              logoImageUrl={logoImageUrl}
              bannerImageUrl={bannerImageUrl}
              headerBackgroundImageUrl={headerBackgroundImageUrl}
              onProfileFileSelected={onProfileFileSelected}
              onLogoFileSelected={onLogoFileSelected}
              onBannerFileSelected={onBannerFileSelected}
              onHeaderBackgroundFileSelected={onHeaderBackgroundFileSelected}
              onRemoveImage={onRemoveImage}
              onChooseFromLibrary={onChooseFromLibrary}
              uploading={uploading}
              uploadingSlots={uploadingSlots}
              processingSlots={processingSlots}
              uploadError={uploadError}
              headerBackgroundColor={headerBackgroundColor}
              onHeaderBackgroundColorChange={onHeaderBackgroundColorChange}
              onOpenPicker={onOpenPicker}
            />

            {/* Interactive Elements */}
            <InteractiveElementsSection
              inputBackgroundColor={inputBackgroundColor}
              onInputBackgroundColorChange={onInputBackgroundColorChange}
              inputTextColor={inputTextColor}
              onInputTextColorChange={onInputTextColorChange}
              buttonBackgroundColor={buttonBackgroundColor}
              onButtonBackgroundColorChange={onButtonBackgroundColorChange}
              buttonTextColor={buttonTextColor}
              onButtonTextColorChange={onButtonTextColorChange}
              onOpenPicker={onOpenPicker}
              disabled={disabled}
            />

            {/* Save Button */}
            {canUpdate && (
              <div className="pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={isSubmitting || uploadingSlots.size > 0 || isProcessing}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting
                    ? "Saving..."
                    : uploadingSlots.size > 0
                      ? "Uploading images…"
                      : isProcessing
                        ? "Processing images…"
                        : "Save Styling"}
                </button>
              </div>
            )}
          </div>

          {/* Right Column — Preview */}
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
  );
}
