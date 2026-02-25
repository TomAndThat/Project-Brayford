"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { auth } from "@brayford/firebase-utils";
import { useToast } from "@/components/shared/Toast";
import {
  type BrandDocument,
  type HeaderType,
  DEFAULT_AUDIENCE_BACKGROUND,
  DEFAULT_INPUT_BACKGROUND,
  DEFAULT_INPUT_TEXT,
  DEFAULT_BUTTON_BACKGROUND,
  DEFAULT_BUTTON_TEXT,
} from "@brayford/core";
import type { ColorEntry } from "@/hooks/use-color-picker";
import type { ColorPickerTarget } from "@/hooks/use-color-picker";
import type { ImageSlot, SlotState } from "@/hooks/use-image-upload";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface UseBrandStylingFormReturn {
  // Page-level colours
  backgroundColor: string;
  setBackgroundColor: (v: string) => void;
  textColor: string;
  setTextColor: (v: string) => void;

  // Header
  headerType: HeaderType;
  setHeaderType: (v: HeaderType) => void;
  headerBackgroundColor: string;
  setHeaderBackgroundColor: (v: string) => void;

  // Interactive element colours
  inputBackgroundColor: string;
  setInputBackgroundColor: (v: string) => void;
  inputTextColor: string;
  setInputTextColor: (v: string) => void;
  buttonBackgroundColor: string;
  setButtonBackgroundColor: (v: string) => void;
  buttonTextColor: string;
  setButtonTextColor: (v: string) => void;

  // Image slots — keyed accessors for use-image-upload
  imageSlots: Record<ImageSlot, SlotState>;

  // Convenience: a record of all colour entries for use-color-picker
  colorEntries: Record<ColorPickerTarget, ColorEntry>;

  // Submission
  isSubmitting: boolean;
  handleStylingSubmit: (e: React.FormEvent) => Promise<void>;
}

// ────────────────────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────────────────────

/**
 * Manages all brand-styling form state: colours, header type, image slot
 * URLs/IDs, and the PATCH submission.
 *
 * State is initialised from the provided `brand` document and re-synced
 * whenever `brand` changes (e.g. after a reload).
 */
export function useBrandStylingForm(
  brand: BrandDocument | null,
  brandId: string,
  reload: () => Promise<void>,
): UseBrandStylingFormReturn {
  const { showToast } = useToast();

  // ── Page-level colours ────────────────────────────────────────────────

  const [backgroundColor, setBackgroundColor] = useState(
    DEFAULT_AUDIENCE_BACKGROUND,
  );
  const [textColor, setTextColor] = useState("#FFFFFF");

  // ── Header ────────────────────────────────────────────────────────────

  const [headerType, setHeaderType] = useState<HeaderType>("none");
  const [headerBackgroundColor, setHeaderBackgroundColor] =
    useState("#000000");

  // ── Image slot state ──────────────────────────────────────────────────

  const [profileImageUrl, setProfileImageUrl] = useState<string | undefined>();
  const [profileImageId, setProfileImageId] = useState<string | undefined>();
  const [logoImageUrl, setLogoImageUrl] = useState<string | undefined>();
  const [logoImageId, setLogoImageId] = useState<string | undefined>();
  const [bannerImageUrl, setBannerImageUrl] = useState<string | undefined>();
  const [bannerImageId, setBannerImageId] = useState<string | undefined>();
  const [headerBackgroundImageUrl, setHeaderBackgroundImageUrl] = useState<
    string | undefined
  >();
  const [headerBackgroundImageId, setHeaderBackgroundImageId] = useState<
    string | undefined
  >();

  // ── Interactive element colours ───────────────────────────────────────

  const [inputBackgroundColor, setInputBackgroundColor] = useState(
    DEFAULT_INPUT_BACKGROUND,
  );
  const [inputTextColor, setInputTextColor] = useState(DEFAULT_INPUT_TEXT);
  const [buttonBackgroundColor, setButtonBackgroundColor] = useState(
    DEFAULT_BUTTON_BACKGROUND,
  );
  const [buttonTextColor, setButtonTextColor] = useState(DEFAULT_BUTTON_TEXT);

  // ── Submitting ────────────────────────────────────────────────────────

  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Sync from brand ───────────────────────────────────────────────────

  useEffect(() => {
    if (!brand) return;
    const s = brand.styling;
    setBackgroundColor(s?.backgroundColor || DEFAULT_AUDIENCE_BACKGROUND);
    setTextColor(s?.textColor || "#FFFFFF");
    setHeaderType(s?.headerType || "none");
    setProfileImageUrl(s?.profileImageUrl ?? undefined);
    setProfileImageId(s?.profileImageId ?? undefined);
    setLogoImageUrl(s?.logoImageUrl ?? undefined);
    setLogoImageId(s?.logoImageId ?? undefined);
    setBannerImageUrl(s?.bannerImageUrl ?? undefined);
    setBannerImageId(s?.bannerImageId ?? undefined);
    setHeaderBackgroundColor(s?.headerBackgroundColor || "#000000");
    setHeaderBackgroundImageUrl(s?.headerBackgroundImageUrl ?? undefined);
    setHeaderBackgroundImageId(s?.headerBackgroundImageId ?? undefined);
    setInputBackgroundColor(
      s?.inputBackgroundColor || DEFAULT_INPUT_BACKGROUND,
    );
    setInputTextColor(s?.inputTextColor || DEFAULT_INPUT_TEXT);
    setButtonBackgroundColor(
      s?.buttonBackgroundColor || DEFAULT_BUTTON_BACKGROUND,
    );
    setButtonTextColor(s?.buttonTextColor || DEFAULT_BUTTON_TEXT);
  }, [brand]);

  // ── Image slots record ────────────────────────────────────────────────

  const imageSlots: Record<ImageSlot, SlotState> = useMemo(
    () => ({
      profile: {
        url: profileImageUrl,
        id: profileImageId,
        setUrl: setProfileImageUrl,
        setId: setProfileImageId,
      },
      logo: {
        url: logoImageUrl,
        id: logoImageId,
        setUrl: setLogoImageUrl,
        setId: setLogoImageId,
      },
      banner: {
        url: bannerImageUrl,
        id: bannerImageId,
        setUrl: setBannerImageUrl,
        setId: setBannerImageId,
      },
      "header-background": {
        url: headerBackgroundImageUrl,
        id: headerBackgroundImageId,
        setUrl: setHeaderBackgroundImageUrl,
        setId: setHeaderBackgroundImageId,
      },
    }),
    [
      profileImageUrl,
      profileImageId,
      logoImageUrl,
      logoImageId,
      bannerImageUrl,
      bannerImageId,
      headerBackgroundImageUrl,
      headerBackgroundImageId,
    ],
  );

  // ── Color entries for useColorPicker ──────────────────────────────────

  const colorEntries: Record<ColorPickerTarget, ColorEntry> = useMemo(
    () => ({
      background: { value: backgroundColor, setValue: setBackgroundColor },
      text: { value: textColor, setValue: setTextColor },
      headerBackground: {
        value: headerBackgroundColor,
        setValue: setHeaderBackgroundColor,
      },
      inputBackground: {
        value: inputBackgroundColor,
        setValue: setInputBackgroundColor,
      },
      inputText: { value: inputTextColor, setValue: setInputTextColor },
      buttonBackground: {
        value: buttonBackgroundColor,
        setValue: setButtonBackgroundColor,
      },
      buttonText: { value: buttonTextColor, setValue: setButtonTextColor },
    }),
    [
      backgroundColor,
      textColor,
      headerBackgroundColor,
      inputBackgroundColor,
      inputTextColor,
      buttonBackgroundColor,
      buttonTextColor,
    ],
  );

  // ── Submit ────────────────────────────────────────────────────────────

  const handleStylingSubmit = useCallback(
    async (e: React.FormEvent) => {
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
            profileImageId: profileImageId || null,
            profileImageUrl: profileImageUrl || null,
            logoImageId: logoImageId || null,
            logoImageUrl: logoImageUrl || null,
            bannerImageId: bannerImageId || null,
            bannerImageUrl: bannerImageUrl || null,
            headerBackgroundColor,
            headerBackgroundImageId: headerBackgroundImageId || null,
            headerBackgroundImageUrl: headerBackgroundImageUrl || null,
            inputBackgroundColor,
            inputTextColor,
            buttonBackgroundColor,
            buttonTextColor,
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
          throw new Error(
            errorData.error || "Failed to update brand styling",
          );
        }

        await reload();
        showToast("Brand styling updated successfully", {
          variant: "success",
        });
      } catch (err) {
        console.error("Error updating brand styling:", err);
        showToast(
          err instanceof Error
            ? err.message
            : "Failed to update brand styling",
          { variant: "error" },
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      brandId,
      reload,
      showToast,
      backgroundColor,
      textColor,
      headerType,
      profileImageId,
      profileImageUrl,
      logoImageId,
      logoImageUrl,
      bannerImageId,
      bannerImageUrl,
      headerBackgroundColor,
      headerBackgroundImageId,
      headerBackgroundImageUrl,
      inputBackgroundColor,
      inputTextColor,
      buttonBackgroundColor,
      buttonTextColor,
    ],
  );

  return {
    backgroundColor,
    setBackgroundColor,
    textColor,
    setTextColor,
    headerType,
    setHeaderType,
    headerBackgroundColor,
    setHeaderBackgroundColor,
    inputBackgroundColor,
    setInputBackgroundColor,
    inputTextColor,
    setInputTextColor,
    buttonBackgroundColor,
    setButtonBackgroundColor,
    buttonTextColor,
    setButtonTextColor,
    imageSlots,
    colorEntries,
    isSubmitting,
    handleStylingSubmit,
  };
}
