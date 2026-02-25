"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface PromptDialogProps {
  /** Whether the dialog is visible. */
  isOpen: boolean;
  /** Dialog heading text. */
  title: string;
  /** Label shown above the text input. */
  label: string;
  /** Placeholder text for the input. */
  placeholder?: string;
  /** Pre-filled value for the input. */
  defaultValue?: string;
  /** Label for the submit button. Defaults to "OK". */
  submitLabel?: string;
  /** Label for the cancel button. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Called with the entered value when the user submits. */
  onSubmit: (value: string) => void;
  /** Called when the user cancels (including backdrop click and Escape). */
  onCancel: () => void;
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

/**
 * Reusable prompt dialog that replaces `window.prompt()`.
 *
 * Renders a modal with a single text input, matching the existing dialog
 * pattern used across the creator app.
 *
 * @example
 * ```tsx
 * <PromptDialog
 *   isOpen={showUrlPrompt}
 *   title="Insert Link"
 *   label="URL"
 *   placeholder="https://example.com"
 *   defaultValue={currentUrl}
 *   submitLabel="Apply"
 *   onSubmit={(url) => { applyLink(url); setShowUrlPrompt(false); }}
 *   onCancel={() => setShowUrlPrompt(false)}
 * />
 * ```
 */
export default function PromptDialog({
  isOpen,
  title,
  label,
  placeholder,
  defaultValue = "",
  submitLabel = "OK",
  cancelLabel = "Cancel",
  onSubmit,
  onCancel,
}: PromptDialogProps): React.ReactElement | null {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset value and focus input when dialog opens
  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, defaultValue]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit(value);
    },
    [value, onSubmit],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    },
    [onCancel],
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md rounded-lg bg-white shadow-xl">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2
                id="prompt-dialog-title"
                className="text-lg font-semibold text-gray-900"
              >
                {title}
              </h2>
              <button
                onClick={onCancel}
                className="text-gray-400 hover:text-gray-500"
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
          <form onSubmit={handleSubmit}>
            <div className="px-6 py-4">
              <label
                htmlFor="prompt-dialog-input"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {label}
              </label>
              <input
                ref={inputRef}
                id="prompt-dialog-input"
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Actions */}
            <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {cancelLabel}
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
