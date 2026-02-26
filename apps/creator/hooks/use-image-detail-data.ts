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
} from "@brayford/core";
import { useToast } from "@/components/shared/Toast";

export interface ImageDetail {
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

export interface UseImageDetailDataReturn {
  user: ReturnType<typeof useAuth>["user"];
  loading: boolean;
  organization: OrganizationDocument | null;
  currentMember: OrganizationMemberDocument | null;
  image: ImageDetail | null;
  setImage: (image: ImageDetail | null) => void;
  canEdit: boolean;
  canDelete: boolean;
  handleSignOut: () => Promise<void>;
}

export function useImageDetailData(imageId: string): UseImageDetailDataReturn {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<OrganizationDocument | null>(
    null,
  );
  const [currentMember, setCurrentMember] =
    useState<OrganizationMemberDocument | null>(null);
  const [image, setImage] = useState<ImageDetail | null>(null);

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
        showToast("You don't have permission to view images.", {
          variant: "error",
        });
        router.push("/dashboard");
      }
    }
  }, [loading, currentMember, organization, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/signin");
  };

  const canEdit = currentMember
    ? hasPermission(currentMember, IMAGES_UPDATE)
    : false;
  const canDelete = currentMember
    ? hasPermission(currentMember, IMAGES_DELETE)
    : false;

  return {
    user,
    loading: authLoading || loading,
    organization,
    currentMember,
    image,
    setImage,
    canEdit,
    canDelete,
    handleSignOut,
  };
}
