"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  auth,
  db,
  uploadImageFile,
  extractImageDimensions,
} from "@brayford/firebase-utils";
import { doc, onSnapshot } from "firebase/firestore";
import { fromBranded, type OrganizationDocument } from "@brayford/core";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

/** The image "slots" available on the brand settings page. */
export type ImageSlot = "profile" | "logo" | "banner" | "header-background";

/**
 * Per-slot state: the URL used for display and the image-library id that
 * will be persisted to the brand document.
 */
export interface SlotState {
  url: string | undefined;
  id: string | undefined;
  setUrl: (v: string | undefined) => void;
  setId: (v: string | undefined) => void;
}

export interface UseImageUploadReturn {
  /** Whether a file upload is currently in flight. */
  uploading: boolean;
  /** Last upload error message, or null. */
  uploadError: string | null;
  /** True if any image slot is waiting for Cloud Function processing. */
  isProcessing: boolean;
  /** The set of slots currently being processed. */
  processingSlots: Set<ImageSlot>;
  /** The set of slots currently uploading in the background. */
  uploadingSlots: Set<ImageSlot>;

  // Crop modal state (parent-owned blob URL)
  cropFile: File | null;
  cropImageUrl: string | null;
  /** Called when the user picks a file for the profile slot (opens crop modal). */
  handleProfileFileSelected: (file: File) => void;
  /** Revoke the crop blob URL and reset crop state. */
  cleanupCropState: () => void;
  /** Called when the crop modal produces a final blob. */
  handleCropComplete: (croppedBlob: Blob) => Promise<void>;

  /** Called when the user picks a file for the logo slot. */
  handleLogoFileSelected: (file: File) => Promise<void>;
  /** Called when the user picks a file for the banner slot. */
  handleBannerFileSelected: (file: File) => Promise<void>;
  /** Called when the user picks a file for the header-background slot. */
  handleHeaderBackgroundFileSelected: (file: File) => Promise<void>;

  /** Clear the URL and ID for a given slot. */
  handleRemoveImage: (slot: ImageSlot) => void;

  /** Retrieve the state helpers for a given slot. */
  getSlot: (slot: ImageSlot) => SlotState;
}

// ────────────────────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────────────────────

/**
 * Manages image upload state for all image slots on the brand settings page:
 * - three-step upload flow (initiate → upload → confirm)
 * - Firestore snapshot listener for Cloud Function processing
 * - crop modal lifecycle for profile images
 *
 * @param organization – the owning organisation (needed for the upload API)
 * @param brandName – used to build a readable image name
 * @param slots – the per-slot state (URL + ID + setters) provided by the
 *   styling form hook
 */
export function useImageUpload(
  organization: OrganizationDocument | null,
  brandName: string | undefined,
  slots: Record<ImageSlot, SlotState>,
): UseImageUploadReturn {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Crop modal state
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);

  // Processing state – tracks slots waiting for the Cloud Function
  const [processingSlots, setProcessingSlots] = useState<Set<ImageSlot>>(
    () => new Set(),
  );
  const processingListenersRef = useRef<Map<string, () => void>>(new Map());
  const isProcessing = processingSlots.size > 0;

  // Per-slot uploading state – tracks which slots have a background upload in flight
  const [uploadingSlots, setUploadingSlots] = useState<Set<ImageSlot>>(
    () => new Set(),
  );

  // Track blob URLs per slot so we can revoke them when replaced
  const blobUrlsRef = useRef<Map<ImageSlot, string>>(new Map());

  // Clean up snapshot listeners on unmount
  useEffect(() => {
    const listeners = processingListenersRef.current;
    return () => {
      for (const unsub of listeners.values()) {
        unsub();
      }
      listeners.clear();
    };
  }, []);

  // Clean up blob URLs on unmount
  useEffect(() => {
    const blobUrls = blobUrlsRef.current;
    return () => {
      for (const url of blobUrls.values()) {
        URL.revokeObjectURL(url);
      }
      blobUrls.clear();
    };
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────

  const getSlot = useCallback(
    (slot: ImageSlot): SlotState => slots[slot],
    [slots],
  );

  /**
   * Set a local blob URL as an instant preview for a slot.
   * Revokes any previous blob URL for the same slot to avoid memory leaks.
   */
  const setOptimisticPreview = useCallback(
    (imageType: ImageSlot, file: File | Blob) => {
      // Revoke previous blob URL for this slot if present
      const previousBlobUrl = blobUrlsRef.current.get(imageType);
      if (previousBlobUrl) {
        URL.revokeObjectURL(previousBlobUrl);
      }

      const blobUrl = URL.createObjectURL(file);
      blobUrlsRef.current.set(imageType, blobUrl);
      slots[imageType].setUrl(blobUrl);
    },
    [slots],
  );

  /**
   * Revoke and clear the blob URL for a slot (called when the real URL arrives
   * or when the upload fails).
   */
  const clearBlobUrl = useCallback((imageType: ImageSlot) => {
    const blobUrl = blobUrlsRef.current.get(imageType);
    if (blobUrl) {
      // Defer revocation slightly so the browser can finish any in-progress
      // image decode against this URL before it becomes invalid.
      setTimeout(() => URL.revokeObjectURL(blobUrl), 500);
      blobUrlsRef.current.delete(imageType);
    }
  }, []);

  // ── Core upload ─────────────────────────────────────────────────────────

  const handleImageUpload = useCallback(
    async (file: File | Blob, imageType: ImageSlot) => {
      if (!organization) return;

      // Mark this slot as uploading (the global `uploading` flag is kept
      // for backwards compatibility but per-slot is now the primary signal)
      setUploading(true);
      setUploadingSlots((prev) => new Set(prev).add(imageType));
      setUploadError(null);

      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error("Not authenticated");

        const filename =
          file instanceof File
            ? file.name
            : `${imageType}-${Date.now()}.png`;
        const contentType = file.type || "image/png";

        let dimensions = { width: 1, height: 1 };
        try {
          dimensions = await extractImageDimensions(file as File);
        } catch {
          // Fall through — 1×1 is valid for blobs
        }

        const imageTypeName = imageType
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
        const imageName = `${brandName || "Brand"} ${imageTypeName}`;

        // Step 1: Initiate
        const initiateResponse = await fetch("/api/images/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            organizationId: fromBranded(organization.id),
            name: imageName,
            filename,
            contentType,
            sizeBytes: file.size,
            dimensions,
          }),
        });

        if (!initiateResponse.ok) {
          const errorData = await initiateResponse.json();
          throw new Error(errorData.error || "Failed to initiate upload");
        }

        const { imageId, storagePath } = await initiateResponse.json();

        // Step 2: Upload to Storage
        const uploadResult = await uploadImageFile(storagePath, file as File);

        // Step 3: Confirm
        const confirmResponse = await fetch(
          `/api/images/${imageId}/confirm`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ url: uploadResult.url }),
          },
        );

        if (!confirmResponse.ok) {
          const errorData = await confirmResponse.json();
          throw new Error(errorData.error || "Failed to confirm upload");
        }

        // Upload complete — swap the blob preview for the real Storage URL
        clearBlobUrl(imageType);
        const { setUrl, setId } = slots[imageType];
        setId(imageId);
        setUrl(uploadResult.url);

        // Remove this slot from the uploading set
        setUploadingSlots((prev) => {
          const next = new Set(prev);
          next.delete(imageType);
          return next;
        });

        // Listen for Cloud Function processing
        setProcessingSlots((prev) => new Set(prev).add(imageType));

        const imageDocRef = doc(db, "images", imageId);
        const unsubscribe = onSnapshot(imageDocRef, (snap) => {
          const data = snap.data();
          if (!data) return;

          if (data.uploadStatus === "processed" && data.url) {
            slots[imageType].setUrl(data.url as string);

            setProcessingSlots((prev) => {
              const next = new Set(prev);
              next.delete(imageType);
              return next;
            });

            unsubscribe();
            processingListenersRef.current.delete(imageId);
          } else if (data.uploadStatus === "failed") {
            setUploadError(
              "Image processing failed. Please try uploading again.",
            );
            setProcessingSlots((prev) => {
              const next = new Set(prev);
              next.delete(imageType);
              return next;
            });
            unsubscribe();
            processingListenersRef.current.delete(imageId);
          }
        });

        processingListenersRef.current.set(imageId, unsubscribe);
      } catch (err) {
        console.error("Upload failed:", err);

        // Upload failed — clear the optimistic blob preview so the user
        // doesn't see a stale local image with no backing upload
        clearBlobUrl(imageType);
        slots[imageType].setUrl(undefined);

        setUploadingSlots((prev) => {
          const next = new Set(prev);
          next.delete(imageType);
          return next;
        });

        setUploadError(
          err instanceof Error ? err.message : "Upload failed",
        );
      } finally {
        setUploading(false);
      }
    },
    [organization, brandName, slots, clearBlobUrl],
  );

  // ── Per-slot handlers ───────────────────────────────────────────────────

  const handleProfileFileSelected = useCallback(
    (file: File) => {
      setCropFile(file);
      setCropImageUrl(URL.createObjectURL(file));
    },
    [],
  );

  const cleanupCropState = useCallback(() => {
    if (cropImageUrl) {
      const urlToRevoke = cropImageUrl;
      setTimeout(() => URL.revokeObjectURL(urlToRevoke), 200);
    }
    setCropFile(null);
    setCropImageUrl(null);
  }, [cropImageUrl]);

  const handleCropComplete = useCallback(
    async (croppedBlob: Blob) => {
      const mimeType = cropFile?.type || "image/png";
      cleanupCropState();
      const blobWithType = new Blob([croppedBlob], { type: mimeType });
      // Show the cropped image immediately as an optimistic preview
      setOptimisticPreview("profile", blobWithType);
      await handleImageUpload(blobWithType as File, "profile");
    },
    [cropFile, cleanupCropState, handleImageUpload, setOptimisticPreview],
  );

  const handleLogoFileSelected = useCallback(
    async (file: File) => {
      setOptimisticPreview("logo", file);
      await handleImageUpload(file, "logo");
    },
    [handleImageUpload, setOptimisticPreview],
  );

  const handleBannerFileSelected = useCallback(
    async (file: File) => {
      setOptimisticPreview("banner", file);
      await handleImageUpload(file, "banner");
    },
    [handleImageUpload, setOptimisticPreview],
  );

  const handleHeaderBackgroundFileSelected = useCallback(
    async (file: File) => {
      setOptimisticPreview("header-background", file);
      await handleImageUpload(file, "header-background");
    },
    [handleImageUpload, setOptimisticPreview],
  );

  const handleRemoveImage = useCallback(
    (imageType: ImageSlot) => {
      clearBlobUrl(imageType);
      const { setUrl, setId } = slots[imageType];
      setUrl(undefined);
      setId(undefined);
    },
    [slots, clearBlobUrl],
  );

  return {
    uploading,
    uploadError,
    isProcessing,
    processingSlots,
    uploadingSlots,
    cropFile,
    cropImageUrl,
    handleProfileFileSelected,
    cleanupCropState,
    handleCropComplete,
    handleLogoFileSelected,
    handleBannerFileSelected,
    handleHeaderBackgroundFileSelected,
    handleRemoveImage,
    getSlot,
  };
}
