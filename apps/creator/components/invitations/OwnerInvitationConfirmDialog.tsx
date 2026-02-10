"use client";

interface OwnerInvitationConfirmDialogProps {
  isOpen: boolean;
  email: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation dialog for inviting a new owner
 *
 * Displays detailed warnings about owner permissions before proceeding
 * with the invitation.
 */
export default function OwnerInvitationConfirmDialog({
  isOpen,
  email,
  onConfirm,
  onCancel,
}: OwnerInvitationConfirmDialogProps) {
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
                Create New Owner?
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
              You&apos;re about to invite <strong>{email}</strong> as an Owner.
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
                    Owners have complete control over this organisation
                  </h3>
                  <div className="mt-2 text-sm text-amber-700">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Full access to billing and payment methods</li>
                      <li>
                        Ability to remove other owners, admins, and members
                      </li>
                      <li>Can delete the entire organisation</li>
                      <li>Access to all brands and events</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-600">
              Are you sure you want to proceed?
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
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Yes, Invite as Owner
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
