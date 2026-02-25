"use client";

/**
 * SandboxJoinPanel
 *
 * Studio view shown for sandbox events in place of a regular settings panel.
 * Displays the audience join URL and QR code so the host can share access
 * during training sessions without needing to go through the events manager.
 *
 * This panel only renders for events where isSandbox = true.
 */

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { getEventQRCodes } from "@brayford/firebase-utils";
import {
  buildQRCodeUrl,
  fromBranded,
  type EventDocument,
} from "@brayford/core";

interface SandboxJoinPanelProps {
  event: EventDocument;
}

export default function SandboxJoinPanel({ event }: SandboxJoinPanelProps) {
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const audienceAppUrl =
    process.env.NEXT_PUBLIC_AUDIENCE_URL || "https://audience.brayford.app";

  useEffect(() => {
    async function loadQRCode() {
      try {
        const codes = await getEventQRCodes(
          event.id,
          event.organizationId,
          true,
        );
        const activeCode = codes[0];
        if (activeCode) {
          const url = buildQRCodeUrl(
            audienceAppUrl,
            fromBranded(event.id),
            fromBranded(activeCode.id),
          );
          setJoinUrl(url);
        }
      } catch (error) {
        console.error("Error loading QR code for sandbox:", error);
      } finally {
        setLoading(false);
      }
    }

    loadQRCode();
  }, [event.id, event.organizationId, audienceAppUrl]);

  const handleCopy = async () => {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for environments where clipboard API is unavailable
      const textarea = document.createElement("textarea");
      textarea.value = joinUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-white">
      <div className="w-full max-w-md">
        <h2 className="text-2xl font-bold text-white mb-1">Join Test Event</h2>
        <p className="text-gray-400 mb-8 text-sm">
          Share this link or QR code with your test audience. This is a sandbox
          event — up to 100 participants, not billable.
        </p>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-gray-400">Loading…</div>
          </div>
        ) : joinUrl ? (
          <div className="space-y-6">
            {/* QR Code */}
            <div className="flex justify-center">
              <div className="bg-white p-4 rounded-lg">
                <QRCodeSVG value={joinUrl} size={220} level="H" includeMargin />
              </div>
            </div>

            {/* Join URL */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Audience join link
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-800 rounded px-3 py-2 text-sm text-gray-200 break-all font-mono">
                  {joinUrl}
                </div>
                <button
                  onClick={handleCopy}
                  className="shrink-0 flex items-center gap-1.5 rounded px-3 py-2 text-sm font-semibold bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <>
                      <svg
                        className="w-4 h-4 text-green-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-green-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Capacity note */}
            <p className="text-xs text-gray-500 text-center">
              Inactive participants are automatically removed after 15 minutes.
            </p>
          </div>
        ) : (
          <div className="text-center text-gray-400">
            <p>No active QR code found for this test event.</p>
          </div>
        )}
      </div>
    </div>
  );
}
