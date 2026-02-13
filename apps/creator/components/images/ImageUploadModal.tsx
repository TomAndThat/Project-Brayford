"use client";

import { useState, useCallback, useRef } from "react";
import { auth } from "@brayford/firebase-utils";
import {
  validateImageFile,
  extractImageDimensions,
  buildImageStoragePath,
  uploadImageFile,
} from "@brayford/firebase-utils";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_TAGS_PER_IMAGE,
  MAX_TAG_LENGTH,
} from "@brayford/core";

interface ImageUploadModalProps {
  organizationId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface UploadEntry {
  file: File;
  name: string;
  description: string;
  tags: string[];
  progress: number;
  status: "pending" | "uploading" | "confirming" | "done" | "error";
  error?: string;
  dimensions?: { width: number; height: number };
}

/**
 * Modal for uploading one or more images to the organisation's image library.
 *
 * Supports drag-and-drop + file picker, multi-file uploads with individual
 * progress, client-side validation, and metadata entry.
 *
 * Flow per file:
 * 1. Client-side validation (type, size)
 * 2. Extract dimensions via browser Image API
 * 3. POST /api/images/upload → creates Firestore doc, returns storagePath
 * 4. Upload file to Firebase Storage via client SDK
 * 5. POST /api/images/{imageId}/confirm → marks status 'ready'
 */
export default function ImageUploadModal({
  organizationId,
  onClose,
  onSuccess,
}: ImageUploadModalProps) {
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newEntries: UploadEntry[] = [];

    for (const file of fileArray) {
      // Client-side validation
      const validationError = validateImageFile(file);
      if (validationError) {
        newEntries.push({
          file,
          name: file.name.replace(/\.[^/.]+$/, ""),
          description: "",
          tags: [],
          progress: 0,
          status: "error",
          error: validationError,
        });
        continue;
      }

      // Extract dimensions
      let dimensions: { width: number; height: number } | undefined;
      try {
        dimensions = await extractImageDimensions(file);
      } catch {
        // If dimension extraction fails, still allow upload
      }

      newEntries.push({
        file,
        name: file.name.replace(/\.[^/.]+$/, ""),
        description: "",
        tags: [],
        progress: 0,
        status: "pending",
        dimensions,
      });
    }

    setUploads((prev) => [...prev, ...newEntries]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = "";
    }
  };

  const updateUpload = (index: number, updates: Partial<UploadEntry>) => {
    setUploads((prev) =>
      prev.map((u, i) => (i === index ? { ...u, ...updates } : u)),
    );
  };

  const removeUpload = (index: number) => {
    setUploads((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadAll = async () => {
    const pendingUploads = uploads.filter((u) => u.status === "pending");
    if (pendingUploads.length === 0) return;

    setIsProcessing(true);
    setGlobalError(null);

    let successCount = 0;

    for (let i = 0; i < uploads.length; i++) {
      const upload = uploads[i]!;
      if (upload.status !== "pending") continue;

      try {
        updateUpload(i, { status: "uploading", progress: 0 });

        // Step 1: Initiate upload via API
        const token = await auth.currentUser?.getIdToken();
        const initiateResponse = await fetch("/api/images/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            organizationId,
            name: upload.name,
            description: upload.description || undefined,
            tags: upload.tags.length > 0 ? upload.tags : undefined,
            filename: upload.file.name,
            contentType: upload.file.type,
            sizeBytes: upload.file.size,
            dimensions: upload.dimensions || { width: 0, height: 0 },
          }),
        });

        if (!initiateResponse.ok) {
          const errorData = await initiateResponse.json();
          throw new Error(errorData.error || "Failed to initiate upload");
        }

        const { imageId, storagePath } = await initiateResponse.json();

        // Step 2: Upload file to Storage via client SDK
        const uploadResult = await uploadImageFile(
          storagePath,
          upload.file,
          (progress) => updateUpload(i, { progress }),
        );

        updateUpload(i, { status: "confirming", progress: 100 });

        // Step 3: Confirm upload
        const confirmResponse = await fetch(`/api/images/${imageId}/confirm`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ url: uploadResult.url }),
        });

        if (!confirmResponse.ok) {
          const errorData = await confirmResponse.json();
          throw new Error(errorData.error || "Failed to confirm upload");
        }

        updateUpload(i, { status: "done", progress: 100 });
        successCount++;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload failed";
        updateUpload(i, { status: "error", error: message });
      }
    }

    setIsProcessing(false);

    if (successCount > 0) {
      // Brief delay to show success states before closing
      setTimeout(() => {
        onSuccess();
      }, 800);
    }
  };

  const pendingCount = uploads.filter((u) => u.status === "pending").length;
  const allDone =
    uploads.length > 0 &&
    uploads.every((u) => u.status === "done" || u.status === "error");
  const maxMB = MAX_IMAGE_SIZE_BYTES / (1024 * 1024);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={!isProcessing ? onClose : undefined}
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl rounded-lg bg-white shadow-xl">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Upload Images
              </h2>
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
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
          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
            {globalError && (
              <div className="mb-4 p-3 rounded-md bg-red-50 text-red-800 text-sm">
                {globalError}
              </div>
            )}

            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragOver
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              <svg
                className="w-10 h-10 text-gray-400 mx-auto mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-sm text-gray-600">
                <span className="font-medium text-blue-600">
                  Click to browse
                </span>{" "}
                or drag and drop
              </p>
              <p className="text-xs text-gray-500 mt-1">
                JPEG, PNG, WebP, or GIF — max {maxMB} MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_IMAGE_TYPES.join(",")}
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Upload list */}
            {uploads.length > 0 && (
              <div className="mt-4 space-y-3">
                {uploads.map((upload, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-start gap-3">
                      {/* Thumbnail preview */}
                      <div className="w-16 h-16 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                        <img
                          src={URL.createObjectURL(upload.file)}
                          alt={upload.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Name input */}
                        <input
                          type="text"
                          value={upload.name}
                          onChange={(e) =>
                            updateUpload(index, { name: e.target.value })
                          }
                          disabled={upload.status !== "pending"}
                          className="block w-full text-sm font-medium text-gray-900 border-0 border-b border-transparent focus:border-blue-500 focus:ring-0 p-0 pb-1 disabled:text-gray-500"
                          placeholder="Image name"
                        />

                        {/* File info */}
                        <p className="text-xs text-gray-500 mt-1">
                          {upload.file.name} ·{" "}
                          {(upload.file.size / 1024).toFixed(0)} KB
                          {upload.dimensions &&
                            ` · ${upload.dimensions.width}×${upload.dimensions.height}`}
                        </p>

                        {/* Tags input (only for pending) */}
                        {upload.status === "pending" && (
                          <div className="mt-2">
                            <input
                              type="text"
                              placeholder="Tags (comma-separated)"
                              onBlur={(e) => {
                                const tags = e.target.value
                                  .split(",")
                                  .map((t) => t.trim())
                                  .filter(
                                    (t) =>
                                      t.length > 0 &&
                                      t.length <= MAX_TAG_LENGTH,
                                  )
                                  .slice(0, MAX_TAGS_PER_IMAGE);
                                updateUpload(index, { tags });
                              }}
                              className="block w-full text-xs border-gray-200 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                        )}

                        {/* Progress bar */}
                        {(upload.status === "uploading" ||
                          upload.status === "confirming") && (
                          <div className="mt-2">
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div
                                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${upload.progress}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {upload.status === "confirming"
                                ? "Confirming..."
                                : `Uploading... ${upload.progress}%`}
                            </p>
                          </div>
                        )}

                        {/* Status */}
                        {upload.status === "done" && (
                          <p className="text-xs text-green-600 mt-2 font-medium">
                            ✓ Upload complete
                          </p>
                        )}
                        {upload.status === "error" && (
                          <p className="text-xs text-red-600 mt-2">
                            {upload.error}
                          </p>
                        )}
                      </div>

                      {/* Remove button (only for pending/error) */}
                      {(upload.status === "pending" ||
                        upload.status === "error") && (
                        <button
                          onClick={() => removeUpload(index)}
                          className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                        >
                          <svg
                            className="w-4 h-4"
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
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
            >
              {allDone ? "Close" : "Cancel"}
            </button>
            {pendingCount > 0 && (
              <button
                onClick={handleUploadAll}
                disabled={isProcessing}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300"
              >
                {isProcessing
                  ? "Uploading..."
                  : `Upload ${pendingCount} ${pendingCount === 1 ? "Image" : "Images"}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
