"use client";

import { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { getEventQRCodes, auth } from "@brayford/firebase-utils";
import {
  fromBranded,
  buildQRCodeUrl,
  type EventId,
  type OrganizationId,
  type QRCodeDocument,
} from "@brayford/core";

interface QRCodeManagementProps {
  eventId: EventId;
  organizationId: OrganizationId;
  canUpdate: boolean;
}

/**
 * QR Code Management Component
 *
 * Displays and manages QR codes for an event.
 * Features:
 * - List all QR codes (active and inactive)
 * - Create new QR codes
 * - Edit QR code names
 * - Activate/deactivate QR codes
 * - Copy QR code URLs
 * - Download QR code images
 */
export default function QRCodeManagement({
  eventId,
  organizationId,
  canUpdate,
}: QRCodeManagementProps) {
  const [qrCodes, setQrCodes] = useState<QRCodeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingQRCode, setEditingQRCode] = useState<QRCodeDocument | null>(
    null,
  );
  const [deactivatingQRCode, setDeactivatingQRCode] =
    useState<QRCodeDocument | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Get audience app URL from environment variable
  const audienceAppUrl =
    process.env.NEXT_PUBLIC_AUDIENCE_URL || "https://audience.brayford.app";

  const loadQRCodes = useCallback(async () => {
    try {
      setLoading(true);
      // Load all QR codes (including inactive) for management view
      const codes = await getEventQRCodes(eventId, organizationId, false);
      setQrCodes(codes);
    } catch (error) {
      console.error("Error loading QR codes:", error);
      setNotification({
        type: "error",
        message: "Failed to load QR codes",
      });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setLoading(false);
    }
  }, [eventId, organizationId]);

  useEffect(() => {
    loadQRCodes();
  }, [loadQRCodes]);

  const handleCreateQRCode = async (name: string) => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");

      const response = await fetch(
        `/api/events/${fromBranded(eventId)}/qr-codes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ name }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create QR code");
      }

      setNotification({
        type: "success",
        message: "QR code created successfully",
      });
      setTimeout(() => setNotification(null), 5000);

      setIsCreateModalOpen(false);
      await loadQRCodes();
    } catch (error) {
      console.error("Error creating QR code:", error);
      setNotification({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to create QR code. Please try again.",
      });
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const handleUpdateQRCode = async (
    qrCodeId: string,
    updates: { name?: string; isActive?: boolean },
  ) => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");

      const response = await fetch(
        `/api/events/${fromBranded(eventId)}/qr-codes/${qrCodeId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify(updates),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update QR code");
      }

      setNotification({
        type: "success",
        message: "QR code updated successfully",
      });
      setTimeout(() => setNotification(null), 5000);

      setEditingQRCode(null);
      await loadQRCodes();
    } catch (error) {
      console.error("Error updating QR code:", error);
      setNotification({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to update QR code. Please try again.",
      });
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const handleDeleteQRCode = async (qrCodeId: string) => {
    try {
      setIsDeactivating(true);
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");

      const response = await fetch(
        `/api/events/${fromBranded(eventId)}/qr-codes/${qrCodeId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to deactivate QR code");
      }

      setNotification({
        type: "success",
        message: "QR code deactivated successfully",
      });
      setTimeout(() => setNotification(null), 5000);

      setDeactivatingQRCode(null);
      await loadQRCodes();
    } catch (error) {
      console.error("Error deactivating QR code:", error);
      setNotification({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to deactivate QR code. Please try again.",
      });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setIsDeactivating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setNotification({
      type: "success",
      message: "URL copied to clipboard",
    });
    setTimeout(() => setNotification(null), 3000);
  };

  const downloadQRCode = (qrCode: QRCodeDocument) => {
    const sourceQR = document.getElementById(`qr-${fromBranded(qrCode.id)}`);
    if (!sourceQR) return;

    // Clone the SVG and scale it up to 2000x2000px (print quality at ~300 DPI = 6.67 inches)
    const svgClone = sourceQR.cloneNode(true) as SVGElement;
    svgClone.setAttribute("width", "2000");
    svgClone.setAttribute("height", "2000");

    const svgData = new XMLSerializer().serializeToString(svgClone);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = 2000;
      canvas.height = 2000;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");

      const downloadLink = document.createElement("a");
      downloadLink.download = `${qrCode.name.replace(/\s+/g, "-").toLowerCase()}-qr-code.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.onerror = () => {
      console.error("Failed to generate QR code image");
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">QR Codes</h3>
        <div className="text-center py-8 text-gray-600">
          Loading QR codes...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">QR Codes</h3>
          <p className="text-sm text-gray-600 mt-1">
            Generate and manage QR codes for audience access
          </p>
        </div>
        {canUpdate && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Create QR Code
          </button>
        )}
      </div>

      {/* Notification */}
      {notification && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            notification.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* QR Codes Grid */}
      {qrCodes.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
            />
          </svg>
          <h4 className="mt-4 text-lg font-medium text-gray-900">
            No QR codes yet
          </h4>
          <p className="mt-2 text-sm text-gray-600">
            Create a QR code to allow audience members to join this event.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {qrCodes.map((qrCode) => {
            const url = buildQRCodeUrl(
              audienceAppUrl,
              fromBranded(eventId),
              fromBranded(qrCode.id),
            );

            return (
              <div
                key={fromBranded(qrCode.id)}
                className={`border rounded-lg p-6 flex gap-6 ${
                  !qrCode.isActive ? "opacity-60 bg-gray-50" : "bg-white"
                }`}
              >
                {/* QR Code Image - Left side */}
                <div className="flex-shrink-0 bg-white p-4 rounded border border-gray-200">
                  <QRCodeSVG
                    id={`qr-${fromBranded(qrCode.id)}`}
                    value={url}
                    size={200}
                    level="H"
                    includeMargin
                  />
                </div>

                {/* QR Code Info and Actions - Right side */}
                <div className="flex-1 flex flex-col">
                  {/* QR Code Info */}
                  <div className="mb-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-gray-900 text-lg">
                        {qrCode.name}
                      </h4>
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          qrCode.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {qrCode.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 break-all">{url}</p>
                  </div>

                  {/* Actions */}
                  <div className="mt-auto">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => copyToClipboard(url)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        Copy URL
                      </button>
                      <button
                        onClick={() => downloadQRCode(qrCode)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        Download
                      </button>

                      {canUpdate && (
                        <>
                          <button
                            onClick={() => setEditingQRCode(qrCode)}
                            className="px-4 py-2 text-sm font-medium text-blue-600 bg-white border border-blue-600 rounded-md hover:bg-blue-50"
                          >
                            Edit
                          </button>
                          {qrCode.isActive ? (
                            <button
                              onClick={() => setDeactivatingQRCode(qrCode)}
                              className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-600 rounded-md hover:bg-red-50"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                handleUpdateQRCode(fromBranded(qrCode.id), {
                                  isActive: true,
                                })
                              }
                              className="px-4 py-2 text-sm font-medium text-green-600 bg-white border border-green-600 rounded-md hover:bg-green-50"
                            >
                              Activate
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create QR Code Modal */}
      {isCreateModalOpen && (
        <CreateQRCodeModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={handleCreateQRCode}
        />
      )}

      {/* Edit QR Code Modal */}
      {editingQRCode && (
        <EditQRCodeModal
          qrCode={editingQRCode}
          onClose={() => setEditingQRCode(null)}
          onUpdate={(name) =>
            handleUpdateQRCode(fromBranded(editingQRCode.id), { name })
          }
        />
      )}

      {/* Deactivate QR Code Confirmation Dialog */}
      {deactivatingQRCode && (
        <DeactivateQRCodeDialog
          qrCode={deactivatingQRCode}
          isDeactivating={isDeactivating}
          onClose={() => setDeactivatingQRCode(null)}
          onConfirm={() =>
            handleDeleteQRCode(fromBranded(deactivatingQRCode.id))
          }
        />
      )}
    </div>
  );
}

/* Create QR Code Modal */
function CreateQRCodeModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("QR code name is required");
      return;
    }

    if (trimmedName.length > 100) {
      setError("QR code name must be 100 characters or less");
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreate(trimmedName);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create QR code");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Create QR Code</h3>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="qr-name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              QR Code Name *
            </label>
            <input
              type="text"
              id="qr-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Social Media QR Code"
              maxLength={100}
              disabled={isSubmitting}
              autoFocus
            />
            <p className="mt-1 text-xs text-gray-500">
              Give this QR code a descriptive name for easy identification
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create QR Code"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* Edit QR Code Modal */
function EditQRCodeModal({
  qrCode,
  onClose,
  onUpdate,
}: {
  qrCode: QRCodeDocument;
  onClose: () => void;
  onUpdate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(qrCode.name);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("QR code name is required");
      return;
    }

    if (trimmedName.length > 100) {
      setError("QR code name must be 100 characters or less");
      return;
    }

    setIsSubmitting(true);
    try {
      await onUpdate(trimmedName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update QR code");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Edit QR Code</h3>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="edit-qr-name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              QR Code Name *
            </label>
            <input
              type="text"
              id="edit-qr-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={100}
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* Deactivate QR Code Confirmation Dialog */
function DeactivateQRCodeDialog({
  qrCode,
  isDeactivating,
  onClose,
  onConfirm,
}: {
  qrCode: QRCodeDocument;
  isDeactivating: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          Deactivate QR Code?
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to deactivate &quot;{qrCode.name}&quot;? This QR
          code will no longer work for audience members. You can reactivate it
          later if needed.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isDeactivating}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeactivating}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {isDeactivating ? "Deactivating..." : "Deactivate QR Code"}
          </button>
        </div>
      </div>
    </div>
  );
}
