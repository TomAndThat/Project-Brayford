"use client";

import { useCallback, useRef, useState, type DragEvent, type ChangeEvent } from "react";
import {
  validateUploadFile,
} from "@brayford/core";

export interface ImageUploaderProps {
  /** Current image URL (if already uploaded) */
  currentImageUrl?: string;
  /** Label shown above the drop zone */
  label: string;
  /** Optional helper text below the label */
  helperText?: string;
  /** Called when user selects a valid file (before upload) */
  onFileSelected: (file: File) => void;
  /** Called when user removes the current image */
  onRemove?: () => void;
  /** Whether the uploader is disabled */
  disabled?: boolean;
  /** Whether an upload is in progress */
  uploading?: boolean;
  /** Upload progress (0–100) */
  progress?: number;
  /** External error message */
  error?: string | null;
}

/**
 * Reusable drag-and-drop image uploader with click-to-browse.
 *
 * Validates file type and size on the client before calling onFileSelected.
 * Does NOT handle the upload itself — the parent component is responsible for
 * uploading via Firebase Storage and managing state.
 */
export default function ImageUploader({
  currentImageUrl,
  label,
  helperText,
  onFileSelected,
  onRemove,
  disabled = false,
  uploading = false,
  progress,
  error,
}: ImageUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayError = error || validationError;

  const handleFile = useCallback(
    (file: File) => {
      setValidationError(null);

      const validationResult = validateUploadFile(file);
      if (validationResult) {
        setValidationError(validationResult);
        return;
      }

      onFileSelected(file);
    },
    [onFileSelected],
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && !uploading) {
        setIsDragOver(true);
      }
    },
    [disabled, uploading],
  );

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled || uploading) return;

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [disabled, uploading, handleFile],
  );

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
      // Reset so the same file can be re-selected
      e.target.value = "";
    },
    [handleFile],
  );

  const handleClick = useCallback(() => {
    if (!disabled && !uploading) {
      fileInputRef.current?.click();
    }
  }, [disabled, uploading]);

  // Show existing image with remove option
  if (currentImageUrl && !uploading) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
        {helperText && (
          <p className="text-xs text-gray-500 mb-3">{helperText}</p>
        )}

        <div className="relative inline-block">
          <img
            src={currentImageUrl}
            alt={label}
            className="max-w-full max-h-48 rounded-lg border border-gray-200 object-contain"
          />

          <div className="mt-3 flex gap-2">
            {/* Replace */}
            <button
              type="button"
              onClick={handleClick}
              disabled={disabled}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Replace
            </button>

            {/* Remove */}
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                disabled={disabled}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-red-700 bg-white border border-red-300 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Remove
              </button>
            )}
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          onChange={handleInputChange}
          className="hidden"
        />

        {displayError && (
          <p className="mt-2 text-sm text-red-600">{displayError}</p>
        )}
      </div>
    );
  }

  // Drop zone
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      {helperText && (
        <p className="text-xs text-gray-500 mb-3">{helperText}</p>
      )}

      <div
        role="button"
        tabIndex={disabled || uploading ? -1 : 0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center
          w-full py-8 px-4
          border-2 border-dashed rounded-lg
          transition-colors cursor-pointer
          ${disabled || uploading
            ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
            : isDragOver
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50"
          }
        `}
      >
        {uploading ? (
          <div className="flex flex-col items-center">
            <div className="mb-3 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
            <p className="text-sm font-medium text-gray-700">Uploading…</p>
            {progress !== undefined && (
              <div className="mt-2 w-48 bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        ) : (
          <>
            <svg
              className={`w-10 h-10 mb-3 ${isDragOver ? "text-blue-500" : "text-gray-400"}`}
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
            <p className="text-sm font-medium text-gray-700 mb-1">
              {isDragOver ? "Drop image here" : "Drag and drop an image, or click to browse"}
            </p>
            <p className="text-xs text-gray-500">
              PNG, JPEG, WebP or SVG · Max 5 MB · Up to 1024×1024px
            </p>
          </>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={handleInputChange}
        className="hidden"
      />

      {displayError && (
        <p className="mt-2 text-sm text-red-600">{displayError}</p>
      )}
    </div>
  );
}
