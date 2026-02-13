"use client";

import { useState, useMemo } from "react";
import { useImageLibrary } from "@/hooks/use-image-library";
import type { ImageLibraryItem } from "@/hooks/use-image-library";
import ImageUploadModal from "./ImageUploadModal";

export interface ImagePickerSelection {
  id: string;
  url: string;
  name: string;
}

interface ImagePickerDialogProps {
  organizationId: string;
  onSelect: (image: ImagePickerSelection) => void;
  onClose: () => void;
  /** Pre-filter by a default tag */
  defaultTag?: string;
}

/**
 * Reusable image selector dialog.
 *
 * Used from Brand Settings, Scene Editor, and anywhere an image is needed.
 * Shows the organisation's image library with search, tag filtering,
 * and an inline upload option (replaces library view temporarily).
 *
 * Props:
 * - organizationId: which org's library to show
 * - onSelect(image): callback when user picks an image
 * - onClose(): callback to dismiss
 * - defaultTag?: pre-filter by tag
 */
export default function ImagePickerDialog({
  organizationId,
  onSelect,
  onClose,
  defaultTag,
}: ImagePickerDialogProps) {
  const [view, setView] = useState<"library" | "upload">("library");
  const [searchQuery, setSearchQuery] = useState("");
  const [tagFilter, setTagFilter] = useState(defaultTag || "");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { images, loading, error } = useImageLibrary(organizationId);

  // Collect unique tags for filtering
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    images.forEach((img) => img.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [images]);

  // Filter + search
  const filteredImages = useMemo(() => {
    let filtered = images;

    if (tagFilter) {
      const tagLower = tagFilter.toLowerCase();
      filtered = filtered.filter((img) =>
        img.tags.some((t) => t.toLowerCase() === tagLower),
      );
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (img) =>
          img.name.toLowerCase().includes(query) ||
          img.description.toLowerCase().includes(query),
      );
    }

    return filtered;
  }, [images, tagFilter, searchQuery]);

  const selectedImage = images.find((img) => img.id === selectedId);

  const handleConfirmSelection = () => {
    if (selectedImage) {
      onSelect({
        id: selectedImage.id,
        url: selectedImage.url,
        name: selectedImage.name,
      });
    }
  };

  const handleUploadSuccess = () => {
    setView("library");
    // New images appear via real-time subscription
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-3xl rounded-lg bg-white shadow-xl">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {view === "library" ? "Select an Image" : "Upload New Image"}
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          {view === "library" ? (
            <div className="px-6 py-4">
              {/* Controls */}
              <div className="flex items-center gap-3 mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search images..."
                  className="flex-1 border border-gray-300 rounded-md shadow-sm py-2 px-3 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <select
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  className="border border-gray-300 rounded-md shadow-sm py-2 px-3 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Tags</option>
                  {allTags.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setView("upload")}
                  className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 whitespace-nowrap"
                >
                  Upload New
                </button>
              </div>

              {/* Error */}
              {error && (
                <div className="mb-4 p-3 rounded-md bg-red-50 text-red-800 text-sm">
                  {error}
                </div>
              )}

              {/* Loading */}
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-gray-600">Loading images...</div>
                </div>
              )}

              {/* Empty */}
              {!loading && filteredImages.length === 0 && (
                <div className="text-center py-12">
                  <svg
                    className="w-12 h-12 text-gray-300 mx-auto mb-3"
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
                  <p className="text-sm text-gray-600 mb-3">
                    {searchQuery || tagFilter
                      ? "No images match your filters."
                      : "No images in your library yet."}
                  </p>
                  <button
                    onClick={() => setView("upload")}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    Upload an image
                  </button>
                </div>
              )}

              {/* Image grid */}
              {!loading && filteredImages.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto">
                  {filteredImages.map((image) => (
                    <button
                      key={image.id}
                      onClick={() => setSelectedId(image.id)}
                      className={`aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 transition-all ${
                        selectedId === image.id
                          ? "border-blue-500 ring-2 ring-blue-200"
                          : "border-transparent hover:border-gray-300"
                      }`}
                    >
                      <img
                        src={image.url}
                        alt={image.name}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Selection info */}
              {selectedImage && (
                <div className="mt-4 p-3 bg-blue-50 rounded-md flex items-center gap-3">
                  <img
                    src={selectedImage.url}
                    alt={selectedImage.name}
                    className="w-10 h-10 rounded object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {selectedImage.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {selectedImage.dimensions.width} ×{" "}
                      {selectedImage.dimensions.height} ·{" "}
                      {selectedImage.contentType.split("/")[1]?.toUpperCase()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="px-6 py-4">
              <button
                onClick={() => setView("library")}
                className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
              >
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back to Library
              </button>

              <ImageUploadModal
                organizationId={organizationId}
                onClose={() => setView("library")}
                onSuccess={handleUploadSuccess}
              />
            </div>
          )}

          {/* Footer (library view only) */}
          {view === "library" && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSelection}
                disabled={!selectedId}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Select Image
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
