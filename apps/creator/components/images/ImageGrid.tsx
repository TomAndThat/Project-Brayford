"use client";

import type { ImageLibraryItem } from "@/hooks/use-image-library";
import { formatFileSize } from "@/hooks/use-images-page-data";

interface ImageGridProps {
  images: ImageLibraryItem[];
  isLoading: boolean;
  error: string | null;
  hasFilters: boolean;
  onImageClick: (imageId: string) => void;
  onUpload: () => void;
}

export default function ImageGrid({
  images,
  isLoading,
  error,
  hasFilters,
  onImageClick,
  onUpload,
}: ImageGridProps) {
  if (error) {
    return (
      <div className="mb-6 p-4 rounded-md bg-red-50 text-red-800">
        <p className="text-sm font-medium">{error}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg text-gray-600">Loading images...</div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-12 text-center">
        <svg
          className="w-16 h-16 text-gray-300 mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {hasFilters ? "No images found" : "No images yet"}
        </h3>
        <p className="text-gray-600 max-w-md mx-auto">
          {hasFilters
            ? "Try adjusting your filters or search query."
            : "Upload your first image to start building your library."}
        </p>
        {!hasFilters && (
          <button
            onClick={onUpload}
            className="mt-6 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Upload Your First Image
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {images.map((image) => (
        <div
          key={image.id}
          onClick={() => onImageClick(image.id)}
          className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer overflow-hidden group"
        >
          {/* Thumbnail */}
          <div className="aspect-square bg-gray-100 relative overflow-hidden">
            {(image.variants?.thumbnail ?? image.url) ? (
              <img
                src={image.variants?.thumbnail ?? image.url}
                alt={image.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {image.name}
            </h3>
            <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
              <span>
                {image.dimensions.width} × {image.dimensions.height}
              </span>
              <span>·</span>
              <span>{formatFileSize(image.sizeBytes)}</span>
            </div>
            {image.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {image.tags.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700"
                  >
                    {t}
                  </span>
                ))}
                {image.tags.length > 3 && (
                  <span className="text-xs text-gray-400">
                    +{image.tags.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
