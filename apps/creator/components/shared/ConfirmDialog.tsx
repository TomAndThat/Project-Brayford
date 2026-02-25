"use client";

import { useCallback, useEffect, useRef } from "react";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

type ConfirmDialogVariant = "danger" | "warning" | "info";

interface ConfirmDialogProps {
  /** Whether the dialog is visible. */
  isOpen: boolean;
  /** Dialog heading text. */
  title: string;
  /** Body message — supports a string or JSX for richer content. */
  message: React.ReactNode;
  /** Label for the confirm button. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Label for the cancel button. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Visual variant controlling colour scheme. Defaults to "warning". */
  variant?: ConfirmDialogVariant;
  /** Whether the confirm action is in progress (shows loading state). */
  isConfirming?: boolean;
  /** Called when the user confirms. */
  onConfirm: () => void;
  /** Called when the user cancels (including backdrop click and Escape). */
  onCancel: () => void;
}

// ────────────────────────────────────────────────────────────────────────────
// Variant styling
// ────────────────────────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<
  ConfirmDialogVariant,
  { button: string; iconColor: string }
> = {
  danger: {
    button: "bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white",
    iconColor: "text-red-400",
  },
  warning: {
    button: "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500 text-white",
    iconColor: "text-amber-400",
  },
  info: {
    button: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white",
    iconColor: "text-blue-400",
  },
};

const WARNING_ICON_PATH =
  "M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z";

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

/**
 * Reusable confirmation dialog that replaces `window.confirm()`.
 *
 * Follows the existing dialog pattern used by `ArchiveBrandDialog`,
 * `RemoveUserConfirmDialog`, etc. — fixed backdrop, centred white card,
 * header/body/footer layout.
 *
 * Supports keyboard interaction (Escape to cancel, focus trapping on
 * the confirm button).
 *
 * @example
 * ```tsx
 * <ConfirmDialog
 *   isOpen={showDialog}
 *   title="Cancel invitation?"
 *   message="The recipient will no longer be able to join using the existing link."
 *   confirmLabel="Cancel Invitation"
 *   variant="danger"
 *   onConfirm={handleCancel}
 *   onCancel={() => setShowDialog(false)}
 * />
 * ```
 */
export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "warning",
  isConfirming = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): React.ReactElement | null {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const style = VARIANT_STYLES[variant];

  // Focus the confirm button when the dialog opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to allow the DOM to render
      const timer = setTimeout(() => {
        confirmButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle Escape key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && !isConfirming) {
        onCancel();
      }
    },
    [isConfirming, onCancel],
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={isConfirming ? undefined : onCancel}
      />

      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md rounded-lg bg-white shadow-xl">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`flex-shrink-0 rounded-full bg-current/10 p-1 ${style.iconColor}`}
                >
                  <svg
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d={WARNING_ICON_PATH}
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <h2
                  id="confirm-dialog-title"
                  className="text-lg font-semibold text-gray-900"
                >
                  {title}
                </h2>
              </div>
              <button
                onClick={onCancel}
                disabled={isConfirming}
                className="text-gray-400 hover:text-gray-500 disabled:opacity-50"
                aria-label="Close"
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
          </div>

          {/* Body */}
          <div className="px-6 py-4">
            {typeof message === "string" ? (
              <p className="text-sm text-gray-700">{message}</p>
            ) : (
              message
            )}
          </div>

          {/* Actions */}
          <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
            <button
              onClick={onCancel}
              disabled={isConfirming}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmButtonRef}
              onClick={onConfirm}
              disabled={isConfirming}
              className={`px-4 py-2 text-sm font-medium border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${style.button}`}
            >
              {isConfirming ? "Processing..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
