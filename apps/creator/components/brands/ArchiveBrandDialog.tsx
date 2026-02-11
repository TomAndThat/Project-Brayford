"use client";

interface ArchiveBrandDialogProps {
  isOpen: boolean;
  brandName: string;
  organizationName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isArchiving?: boolean;
}

/**
 * Confirmation dialog for archiving a brand
 *
 * Displays clear warnings about what archiving means before proceeding.
 */
export default function ArchiveBrandDialog({
  isOpen,
  brandName,
  organizationName,
  onConfirm,
  onCancel,
  isArchiving = false,
}: ArchiveBrandDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={isArchiving ? undefined : onCancel}
      />

      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md rounded-lg bg-white shadow-xl">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Archive Brand?
              </h2>
              <button
                onClick={onCancel}
                disabled={isArchiving}
                className="text-gray-400 hover:text-gray-500 disabled:opacity-50"
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
          <div className="px-6 py-4 space-y-4">
            <p className="text-sm text-gray-700">
              You&apos;re about to archive <strong>{brandName}</strong> from{" "}
              <strong>{organizationName}</strong>.
            </p>

            <div className="rounded-md bg-amber-50 p-4 border border-amber-200">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-amber-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-amber-800">
                    What happens when you archive:
                  </h3>
                  <div className="mt-2 text-sm text-amber-700">
                    <ul className="list-disc list-inside space-y-1">
                      <li>The brand will be hidden from active brand lists</li>
                      <li>
                        Associated events will remain accessible (read-only)
                      </li>
                      <li>Historical data and analytics are preserved</li>
                      <li>You can restore the brand at any time</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-600">
              To view and restore archived brands, use the filter on the Brands
              page.
            </p>
          </div>

          {/* Actions */}
          <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
            <button
              onClick={onCancel}
              disabled={isArchiving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isArchiving}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-600 border border-transparent rounded-md hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isArchiving ? "Archiving..." : "Archive Brand"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
