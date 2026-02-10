"use client";

interface RemoveUserConfirmDialogProps {
  isOpen: boolean;
  userName: string;
  userEmail: string;
  organizationName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation dialog for removing a user from the organisation
 *
 * Displays clear warnings about access loss before proceeding with removal.
 */
export default function RemoveUserConfirmDialog({
  isOpen,
  userName,
  userEmail,
  organizationName,
  onConfirm,
  onCancel,
}: RemoveUserConfirmDialogProps) {
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
        <div className="relative w-full max-w-md rounded-lg bg-white shadow-xl">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Remove Team Member?
              </h2>
              <button
                onClick={onCancel}
                className="text-gray-400 hover:text-gray-500"
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
              You&apos;re about to remove <strong>{userName}</strong> (
              {userEmail}) from <strong>{organizationName}</strong>.
            </p>

            <div className="rounded-md bg-red-50 p-4 border border-red-200">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    This user will immediately lose access to:
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <ul className="list-disc list-inside space-y-1">
                      <li>All brands in this organisation</li>
                      <li>All events and event data</li>
                      <li>All organisation settings and analytics</li>
                      <li>The ability to sign in to this organisation</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-600">
              This action cannot be undone. You&apos;ll need to send a new
              invitation if you want to add them back later.
            </p>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4">
            <div className="flex justify-end gap-3">
              <button
                onClick={onCancel}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                data-testid="confirm-remove-user-btn"
              >
                Remove User
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
