/**
 * Audience app — not found page.
 *
 * Rendered by Next.js when no matching route is found, or when notFound() is
 * called from within a route segment. Provides a human-friendly alternative to
 * the default browser 404 experience.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-6 mx-auto h-16 w-16 rounded-full bg-zinc-100 flex items-center justify-center">
          <svg
            className="h-8 w-8 text-zinc-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h1 className="mb-3 text-2xl font-semibold text-zinc-900">
          Page Not Found
        </h1>
        <p className="text-lg text-zinc-600">
          This link doesn&apos;t exist or may have expired. Scan the QR code at
          your event to get involved.
        </p>
      </div>
    </div>
  );
}
