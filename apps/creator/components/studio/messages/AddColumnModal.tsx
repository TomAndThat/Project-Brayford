"use client";

import { useState } from "react";
import { MAX_COLUMN_NAME_LENGTH } from "@brayford/core";

interface AddColumnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

/**
 * Modal for creating a new message moderation column.
 *
 * Validates the column name client-side before calling `onCreate`.
 * Closes automatically on success; surfaces errors inline on failure.
 */
export default function AddColumnModal({
  isOpen,
  onClose,
  onCreate,
}: AddColumnModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const handleClose = () => {
    if (isBusy) return;
    setName("");
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();

    if (!trimmed) {
      setError("Column name is required.");
      return;
    }
    if (trimmed.length > MAX_COLUMN_NAME_LENGTH) {
      setError(
        `Column name must not exceed ${MAX_COLUMN_NAME_LENGTH} characters.`,
      );
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      await onCreate(trimmed);
      setName("");
      onClose();
    } catch {
      setError("Failed to create column. Please try again.");
    } finally {
      setIsBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-column-title"
        className="relative z-10 w-full max-w-sm rounded-xl bg-gray-900 border border-gray-700 shadow-2xl p-6"
      >
        <h2
          id="add-column-title"
          className="text-base font-semibold text-white mb-4"
        >
          New column
        </h2>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-5">
            <label
              htmlFor="column-name-input"
              className="block text-xs font-medium text-gray-400 mb-1.5"
            >
              Column name
            </label>
            <input
              id="column-name-input"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="e.g. On Air"
              maxLength={MAX_COLUMN_NAME_LENGTH}
              autoFocus
              disabled={isBusy}
              className="w-full rounded-lg bg-gray-800 border border-gray-600 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
            />
            {error && (
              <p role="alert" className="mt-1.5 text-xs text-red-400">
                {error}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isBusy}
              className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isBusy || !name.trim()}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isBusy ? "Creating…" : "Create column"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
