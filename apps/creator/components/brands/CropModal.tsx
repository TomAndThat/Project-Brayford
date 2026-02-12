"use client";

import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";

export interface CropModalProps {
  /** The image file to crop */
  imageFile: File;
  /** Called with the cropped Blob when user confirms */
  onCropComplete: (croppedBlob: Blob) => void;
  /** Called when user cancels */
  onCancel: () => void;
}

/**
 * Crop modal that enforces a 1:1 aspect ratio for profile images.
 * Uses react-easy-crop for zoom/pan controls.
 * Produces a cropped Blob ready for upload.
 */
export default function CropModal({
  imageFile,
  onCropComplete,
  onCancel,
}: CropModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Create object URL for the image
  const imageUrl = URL.createObjectURL(imageFile);

  const handleCropChange = useCallback((location: Point) => {
    setCrop(location);
  }, []);

  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  const handleCropComplete = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    [],
  );

  const handleConfirm = useCallback(async () => {
    if (!croppedAreaPixels) return;

    setIsProcessing(true);

    try {
      const croppedBlob = await cropImage(
        imageUrl,
        croppedAreaPixels,
        imageFile.type,
      );
      onCropComplete(croppedBlob);
    } catch (error) {
      console.error("Failed to crop image:", error);
    } finally {
      setIsProcessing(false);
      URL.revokeObjectURL(imageUrl);
    }
  }, [croppedAreaPixels, imageUrl, imageFile.type, onCropComplete]);

  const handleCancel = useCallback(() => {
    URL.revokeObjectURL(imageUrl);
    onCancel();
  }, [imageUrl, onCancel]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60" onClick={handleCancel} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Crop Profile Image
            </h3>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-1"
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

          {/* Crop area */}
          <div className="relative w-full h-80 bg-gray-900">
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={handleCropChange}
              onZoomChange={handleZoomChange}
              onCropComplete={handleCropComplete}
              cropShape="rect"
              showGrid
            />
          </div>

          {/* Zoom slider */}
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center gap-3">
              <svg
                className="w-4 h-4 text-gray-400 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"
                />
              </svg>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600"
              />
              <svg
                className="w-4 h-4 text-gray-400 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                />
              </svg>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isProcessing}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isProcessing || !croppedAreaPixels}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? "Processing…" : "Crop & Upload"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Crop an image using Canvas API and return as a Blob.
 */
async function cropImage(
  imageSrc: string,
  pixelCrop: Area,
  mimeType: string,
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  // Use the original MIME type, falling back to PNG
  const outputType = ["image/png", "image/jpeg", "image/webp"].includes(
    mimeType,
  )
    ? mimeType
    : "image/png";

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Canvas toBlob returned null"));
        }
      },
      outputType,
      0.92, // Quality for JPEG/WebP
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
