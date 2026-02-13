"use client";

interface WaitingScreenProps {
  eventName: string;
}

/**
 * Displayed when no scene is active
 *
 * Shows a simple waiting message to audience members before
 * the event starts or between scenes.
 */
export default function WaitingScreen({ eventName }: WaitingScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] px-6 py-12 text-center">
      <div className="mb-6 opacity-40">
        <svg
          className="w-16 h-16 mx-auto"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
      </div>
      <h2 className="text-xl font-semibold mb-2 opacity-90">{eventName}</h2>
      <p className="text-sm opacity-60">Waiting for the show to start…</p>
    </div>
  );
}
