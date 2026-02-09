"use client";

import { useEffect, useState } from "react";

interface FirebaseStatus {
  initialized: boolean;
  error: string | null;
  config: Record<string, string> | null;
}

export default function TestFirebasePage() {
  const [status, setStatus] = useState<FirebaseStatus>({
    initialized: false,
    error: null,
    config: null,
  });

  useEffect(() => {
    async function testFirebase() {
      try {
        // Dynamic import to avoid SSR issues
        const { firebaseConfig, auth, db } =
          await import("@brayford/firebase-utils");

        setStatus({
          initialized: true,
          error: null,
          config: {
            projectId: firebaseConfig.projectId || "Not set",
            authDomain: firebaseConfig.authDomain || "Not set",
            apiKey: firebaseConfig.apiKey ? "✓ Set" : "✗ Not set",
          },
        });
      } catch (error) {
        setStatus({
          initialized: false,
          error: error instanceof Error ? error.message : "Unknown error",
          config: null,
        });
      }
    }

    testFirebase();
  }, []);

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Firebase Configuration Test</h1>

        <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
          <div className="flex items-center space-x-2">
            <div
              className={`w-3 h-3 rounded-full ${status.initialized ? "bg-green-500" : status.error ? "bg-red-500" : "bg-yellow-500"}`}
            ></div>
            <span className="font-semibold">
              {status.initialized
                ? "Firebase Initialized"
                : status.error
                  ? "Initialization Failed"
                  : "Initializing..."}
            </span>
          </div>

          {status.error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded">
              <h3 className="font-semibold text-red-800 mb-2">Error:</h3>
              <pre className="text-sm text-red-600 whitespace-pre-wrap">
                {status.error}
              </pre>
            </div>
          )}

          {status.config && (
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-800">Configuration:</h3>
              <div className="bg-gray-50 p-4 rounded space-y-1 text-sm font-mono">
                <div>
                  <strong>Project ID:</strong> {status.config.projectId}
                </div>
                <div>
                  <strong>Auth Domain:</strong> {status.config.authDomain}
                </div>
                <div>
                  <strong>API Key:</strong> {status.config.apiKey}
                </div>
              </div>
            </div>
          )}

          {status.initialized && (
            <div className="p-4 bg-green-50 border border-green-200 rounded">
              <p className="text-green-800">
                ✓ Firebase is properly configured and ready to use.
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-2">Next Steps:</h3>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>Verify all environment variables are set in .env.local</li>
              <li>Test authentication with Google OAuth</li>
              <li>Verify Firestore connection</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
