interface FullScreenLoaderProps {
  message?: string;
}

/**
 * Full-screen loading state for the audience app.
 * Displays a centred spinner with an optional status message.
 */
export default function FullScreenLoader({
  message = "Loading...",
}: FullScreenLoaderProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="text-center">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-600 mx-auto" />
        <p className="text-lg text-zinc-600">{message}</p>
      </div>
    </div>
  );
}
