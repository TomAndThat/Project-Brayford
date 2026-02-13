'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@brayford/firebase-utils';
import type { ImageUploadStatus } from '@brayford/core';

/**
 * Client-side image document shape returned by the hook
 */
export interface ImageLibraryItem {
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
  uploadStatus: ImageUploadStatus;
  usageCount: number;
  usedBy: { brands: string[]; scenes: string[] };
  createdAt: Date | null;
  createdBy: string;
  updatedAt: Date | null;
  updatedBy: string;
  isActive: boolean;
}

export interface UseImageLibraryOptions {
  /** Filter by tag (optional) */
  tag?: string;
  /** Filter by upload status (default: 'ready') */
  uploadStatus?: ImageUploadStatus;
}

export interface UseImageLibraryReturn {
  images: ImageLibraryItem[];
  loading: boolean;
  error: string | null;
}

/**
 * Real-time subscription to an organization's image library.
 *
 * Subscribes to the /images collection where organizationId matches
 * and isActive === true. Returns filtered, sorted images.
 *
 * @param organizationId - Organization to watch (null to disable)
 * @param options - Optional filters (tag, uploadStatus)
 * @returns { images, loading, error }
 *
 * @example
 * ```tsx
 * function ImageGrid({ orgId }: { orgId: string }) {
 *   const { images, loading, error } = useImageLibrary(orgId);
 *
 *   if (loading) return <div>Loading images...</div>;
 *   if (error) return <div>Error: {error}</div>;
 *
 *   return (
 *     <div className="grid grid-cols-4 gap-4">
 *       {images.map(img => (
 *         <img key={img.id} src={img.url} alt={img.name} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useImageLibrary(
  organizationId: string | null,
  options: UseImageLibraryOptions = {},
): UseImageLibraryReturn {
  const { tag, uploadStatus = 'ready' } = options;
  const [images, setImages] = useState<ImageLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use ref for tag to avoid re-subscribing on tag change (client-side filter)
  const tagRef = useRef(tag);
  tagRef.current = tag;

  useEffect(() => {
    if (!organizationId) {
      setImages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const imagesQuery = query(
      collection(db, 'images'),
      where('organizationId', '==', organizationId),
      where('isActive', '==', true),
      where('uploadStatus', '==', uploadStatus),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe: Unsubscribe = onSnapshot(
      imagesQuery,
      (snapshot) => {
        let items: ImageLibraryItem[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            organizationId: data.organizationId,
            name: data.name,
            description: data.description || '',
            tags: data.tags || [],
            storagePath: data.storagePath,
            url: data.url,
            filename: data.filename,
            contentType: data.contentType,
            sizeBytes: data.sizeBytes,
            dimensions: data.dimensions || { width: 0, height: 0 },
            uploadStatus: data.uploadStatus,
            usageCount: data.usageCount || 0,
            usedBy: data.usedBy || { brands: [], scenes: [] },
            createdAt: data.createdAt?.toDate?.() || null,
            createdBy: data.createdBy,
            updatedAt: data.updatedAt?.toDate?.() || null,
            updatedBy: data.updatedBy,
            isActive: data.isActive,
          };
        });

        // Client-side tag filter
        if (tagRef.current) {
          const tagLower = tagRef.current.toLowerCase();
          items = items.filter((img) =>
            img.tags.some((t) => t.toLowerCase() === tagLower),
          );
        }

        setImages(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Image library subscription error:', err);
        setError('Failed to load images');
        setLoading(false);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [organizationId, uploadStatus]);

  // Re-apply tag filter when tag changes (without re-subscribing)
  const filteredImages = tag
    ? images.filter((img) =>
        img.tags.some((t) => t.toLowerCase() === tag.toLowerCase()),
      )
    : images;

  return {
    images: filteredImages,
    loading,
    error,
  };
}
