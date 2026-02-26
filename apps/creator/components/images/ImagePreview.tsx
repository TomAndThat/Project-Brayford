"use client";

import type { ImageDetail } from "@/hooks/use-image-detail-data";

// ── Utility functions ─────────────────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatContentType(type: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WebP",
    "image/gif": "GIF",
  };
  return map[type] || type;
}

// ── Component ─────────────────────────────────────────────────────────

interface ImagePreviewProps {
  image: ImageDetail;
}

export default function ImagePreview({ image }: ImagePreviewProps) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="aspect-auto max-h-[500px] bg-gray-100 flex items-center justify-center">
        <img
          src={image.variants?.display ?? image.url}
          alt={image.name}
          className="max-w-full max-h-[500px] object-contain"
        />
      </div>

      {/* Read-only file info */}
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
          <dd className="text-gray-900">{formatFileSize(image.sizeBytes)}</dd>

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
  );
}
