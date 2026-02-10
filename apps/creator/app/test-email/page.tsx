"use client";

import { useState } from "react";
import {
  queueTestEmail,
  queueTestBatchEmail,
  queueInvitationEmail,
} from "@/lib/test-email";

/**
 * Email Queue Test Page
 *
 * Simple UI for testing the email queue system.
 * Navigate to /test-email to use this page.
 */
export default function TestEmailPage() {
  const [email, setEmail] = useState("test@example.com");
  const [invitationId, setInvitationId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleTestImmediate = async () => {
    setLoading(true);
    setResult(null);

    try {
      const emailId = await queueTestEmail(email);
      setResult(
        `✅ Immediate email queued: ${emailId}\n\nCheck the Functions emulator logs to see it being processed.`,
      );
    } catch (error) {
      setResult(
        `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTestBatch = async () => {
    setLoading(true);
    setResult(null);

    try {
      const emailId = await queueTestBatchEmail(email);
      setResult(
        `✅ Batch email queued: ${emailId}\n\nWill be processed within 1 minute by the scheduled function.`,
      );
    } catch (error) {
      setResult(
        `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTestInvitation = async () => {
    if (!invitationId.trim()) {
      setResult("❌ Error: Please enter an invitation ID");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const emailId = await queueInvitationEmail(invitationId.trim());
      setResult(
        `✅ Invitation email queued: ${emailId}\n\nCheck the Functions emulator logs to see it being processed.`,
      );
    } catch (error) {
      setResult(
        `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow p-8">
          <h1 className="text-3xl font-bold mb-2">Email Queue Test</h1>
          <p className="text-gray-600 mb-8">
            Test the Cloud Functions email queue system. Make sure Firebase
            emulators are running.
          </p>

          <div className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Test Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="test@example.com"
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleTestImmediate}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Queueing..." : "Test Immediate Email"}
              </button>

              <button
                onClick={handleTestBatch}
                disabled={loading}
                className="flex-1 bg-green-600 text-white px-6 py-3 rounded-md font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Queueing..." : "Test Batch Email"}
              </button>
            </div>

            <div className="mt-8 pt-8 border-t border-gray-200">
              <h2 className="text-xl font-semibold mb-4">
                Manual Invitation Email
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Process an existing invitation document (useful if it was
                created before the trigger was deployed)
              </p>
              <div>
                <label
                  htmlFor="invitationId"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Invitation ID
                </label>
                <input
                  type="text"
                  id="invitationId"
                  value={invitationId}
                  onChange={(e) => setInvitationId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
                  placeholder="DL47uRgfT4ulIbtict8J"
                />
                <button
                  onClick={handleTestInvitation}
                  disabled={loading || !invitationId.trim()}
                  className="w-full bg-purple-600 text-white px-6 py-3 rounded-md font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Queueing..." : "Queue Invitation Email"}
                </button>
              </div>
            </div>

            {result && (
              <div className="mt-6 p-4 bg-gray-100 rounded-md">
                <pre className="text-sm whitespace-pre-wrap">{result}</pre>
              </div>
            )}

            <div className="mt-8 p-4 bg-blue-50 rounded-md">
              <h3 className="font-medium text-blue-900 mb-2">How to test:</h3>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>
                  Make sure Firebase emulators are running:{" "}
                  <code className="bg-blue-100 px-1 rounded">
                    firebase emulators:start
                  </code>
                </li>
                <li>
                  Ensure{" "}
                  <code className="bg-blue-100 px-1 rounded">
                    EMAIL_DEV_MODE=true
                  </code>{" "}
                  in{" "}
                  <code className="bg-blue-100 px-1 rounded">
                    functions/.env
                  </code>
                </li>
                <li>
                  Click "Test Immediate Email" to queue a transactional email
                </li>
                <li>Check the Functions emulator logs for the email details</li>
                <li>
                  The email will be logged to console instead of sent via
                  Postmark
                </li>
              </ol>
            </div>

            <div className="mt-4 p-4 bg-yellow-50 rounded-md">
              <h3 className="font-medium text-yellow-900 mb-2">
                Expected logs:
              </h3>
              <pre className="text-xs text-yellow-800 overflow-x-auto">
                {`📧 [DEV MODE] Email queued but not sent
   To: test@example.com
   Type: invitation
   Template: brayford-invitation-member
   Data: { organizationName: "Test Organization", ... }`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
