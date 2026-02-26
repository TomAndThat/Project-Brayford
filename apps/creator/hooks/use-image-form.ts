"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@brayford/firebase-utils";
import {
  MAX_TAGS_PER_IMAGE,
  MAX_TAG_LENGTH,
} from "@brayford/core";
import { useToast } from "@/components/shared/Toast";
import type { ImageDetail } from "@/hooks/use-image-detail-data";

export interface UseImageFormReturn {
  editName: string;
  setEditName: (name: string) => void;
  editDescription: string;
  setEditDescription: (desc: string) => void;
  editTags: string[];
  newTag: string;
  setNewTag: (tag: string) => void;
  isSaving: boolean;
  isDeleting: boolean;
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (show: boolean) => void;
  showCascadeConfirm: boolean;
  setShowCascadeConfirm: (show: boolean) => void;
  cascadeData: {
    usedBy: { brands: string[]; scenes: string[] };
    liveEventWarnings: string[];
  } | null;
  setCascadeData: (data: {
    usedBy: { brands: string[]; scenes: string[] };
    liveEventWarnings: string[];
  } | null) => void;
  handleSave: () => Promise<void>;
  handleDelete: (force?: boolean) => Promise<void>;
  handleCascadeConfirm: () => Promise<void>;
  handleAddTag: () => void;
  handleRemoveTag: (tag: string) => void;
}

export function useImageForm(
  image: ImageDetail | null,
  canEdit: boolean,
  setImage: (image: ImageDetail | null) => void,
): UseImageFormReturn {
  const router = useRouter();
  const { showToast } = useToast();

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

  // Sync form values from image data
  useEffect(() => {
    if (image) {
      setEditName(image.name);
      setEditDescription(image.description || "");
      setEditTags(image.tags || []);
    }
  }, [image]);

  const handleSave = async () => {
    if (!image) return;

    if (!canEdit) {
      showToast("You do not have permission to update images.", {
        variant: "error",
      });
      return;
    }

    setIsSaving(true);

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
        showToast("Image updated successfully.", { variant: "success" });
      } else {
        const errorData = await response.json();
        showToast(errorData.error || "Failed to update image.", {
          variant: "error",
        });
      }
    } catch {
      showToast("Failed to update image.", { variant: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (force = false) => {
    if (!image) return;

    setIsDeleting(true);

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
        if (force && response.ok) {
          const data = await response.json();
          const totalRemoved =
            (data.removed?.brands || 0) + (data.removed?.scenes || 0);
          showToast(
            `Image deleted and removed from ${totalRemoved} ${totalRemoved === 1 ? "item" : "items"}.`,
            { variant: "success" },
          );
          setTimeout(() => router.push("/dashboard/images"), 2000);
        } else {
          router.push("/dashboard/images");
        }
        return;
      }

      if (response.status === 409) {
        const data = await response.json();
        setCascadeData({
          usedBy: data.usedBy || { brands: [], scenes: [] },
          liveEventWarnings: data.liveEventWarnings || [],
        });
        setShowDeleteConfirm(false);
        setShowCascadeConfirm(true);
      } else {
        const errorData = await response.json();
        showToast(errorData.error || "Failed to delete image.", {
          variant: "error",
        });
      }
    } catch {
      showToast("Failed to delete image.", { variant: "error" });
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

  return {
    editName,
    setEditName,
    editDescription,
    setEditDescription,
    editTags,
    newTag,
    setNewTag,
    isSaving,
    isDeleting,
    showDeleteConfirm,
    setShowDeleteConfirm,
    showCascadeConfirm,
    setShowCascadeConfirm,
    cascadeData,
    setCascadeData,
    handleSave,
    handleDelete,
    handleCascadeConfirm,
    handleAddTag,
    handleRemoveTag,
  };
}
