"use client";

import type { UseImageFormReturn } from "@/hooks/use-image-form";

interface ImageDangerZoneProps {
  form: Pick<
    UseImageFormReturn,
    | "isDeleting"
    | "showDeleteConfirm"
    | "setShowDeleteConfirm"
    | "showCascadeConfirm"
    | "setShowCascadeConfirm"
    | "cascadeData"
    | "setCascadeData"
    | "handleDelete"
    | "handleCascadeConfirm"
  >;
}

export default function ImageDangerZone({ form }: ImageDangerZoneProps) {
  return (
    <>
      {/* Danger Zone Card */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-red-200">
        <h3 className="text-lg font-semibold text-red-900 mb-2">Danger Zone</h3>
        <p className="text-sm text-gray-600 mb-4">
          Permanently delete this image from your library. This action cannot be
          undone.
        </p>

        {!form.showDeleteConfirm ? (
          <button
            onClick={() => form.setShowDeleteConfirm(true)}
            className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100"
          >
            Delete Image
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={() => form.handleDelete(false)}
              disabled={form.isDeleting}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-gray-300"
            >
              {form.isDeleting ? "Deleting..." : "Confirm Delete"}
            </button>
            <button
              onClick={() => form.setShowDeleteConfirm(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Cascade Delete Confirmation Modal */}
      {form.showCascadeConfirm && form.cascadeData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Image In Use
            </h3>

            <div className="mb-4 space-y-3">
              <p className="text-sm text-gray-700">
                This image is currently used by:
              </p>

              {form.cascadeData.usedBy.brands.length > 0 && (
                <div className="p-3 bg-blue-50 rounded-md">
                  <div className="text-sm font-medium text-blue-900">
                    {form.cascadeData.usedBy.brands.length}{" "}
                    {form.cascadeData.usedBy.brands.length === 1
                      ? "Brand"
                      : "Brands"}
                  </div>
                </div>
              )}

              {form.cascadeData.usedBy.scenes.length > 0 && (
                <div className="p-3 bg-purple-50 rounded-md">
                  <div className="text-sm font-medium text-purple-900">
                    {form.cascadeData.usedBy.scenes.length}{" "}
                    {form.cascadeData.usedBy.scenes.length === 1
                      ? "Scene"
                      : "Scenes"}
                  </div>
                </div>
              )}

              {form.cascadeData.liveEventWarnings.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                  {form.cascadeData.liveEventWarnings.map(
                    (warning: string, idx: number) => (
                      <div
                        key={idx}
                        className="text-sm font-medium text-amber-900"
                      >
                        {warning}
                      </div>
                    ),
                  )}
                </div>
              )}

              <p className="text-sm text-gray-600 mt-4">
                Deleting this image will remove it from all these items and may
                affect their appearance.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  form.setShowCascadeConfirm(false);
                  form.setCascadeData(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={form.handleCascadeConfirm}
                disabled={form.isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-gray-300"
              >
                {form.isDeleting ? "Deleting..." : "Remove and Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
