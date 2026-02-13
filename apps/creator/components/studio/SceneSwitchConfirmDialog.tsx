"use client";

import { useEffect, useCallback } from "react";

interface SceneSwitchConfirmDialogProps {
  isOpen: boolean;
  sceneName: string;
  isClearAction: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation dialog shown before switching scenes (when enabled).
 *
 * Follows the existing Project Brayford dialog pattern:
 * z-[60] stacking, backdrop with click-to-cancel, white card.
 *
 * Handles keyboard: Enter to confirm, Escape to cancel.
 */
export default function SceneSwitchConfirmDialog({
  isOpen,
  sceneName,
  isClearAction,
  onConfirm,
  onCancel,
}: SceneSwitchConfirmDialogProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }

      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        onConfirm();
      }
    },
    [isOpen, onCancel, onConfirm],
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-sm rounded-lg bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {isClearAction ? "Clear Screen" : "Switch Scene"}
            </h3>
            <button
              onClick={onCancel}
              className="rounded-md p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg
                className="h-5 w-5"
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

          {/* Body */}
          <div className="px-6 py-4">
            <p className="text-sm text-gray-600">
              {isClearAction ? (
                "This will clear the screen for all audience members. No content will be displayed."
              ) : (
                <>
                  Switch the live scene to{" "}
                  <span className="font-semibold text-gray-900">
                    {sceneName}
                  </span>
                  ? All audience members will see this change immediately.
                </>
              )}
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              onClick={onCancel}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              {isClearAction ? "Clear Screen" : "Go Live"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
