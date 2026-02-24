import { type ReactNode } from "react";

interface FullScreenMessageProps {
  /** Tailwind background class for the icon circle, e.g. "bg-amber-100" */
  iconBgClass: string;
  /** Tailwind colour class for the SVG icon, e.g. "text-amber-600" */
  iconColorClass: string;
  /** SVG path elements rendered inside a 24×24 viewBox icon */
  icon: ReactNode;
  /** Primary heading */
  title: string;
  /** Supporting description */
  message: string;
  /** Optional additional content rendered below the message */
  children?: ReactNode;
}

/**
 * Full-screen informational state for the audience app.
 * Used for error states, access-gated events, and not-found pages.
 */
export default function FullScreenMessage({
  iconBgClass,
  iconColorClass,
  icon,
  title,
  message,
  children,
}: FullScreenMessageProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="max-w-md w-full text-center">
        <div
          className={`mb-6 mx-auto h-16 w-16 rounded-full flex items-center justify-center ${iconBgClass}`}
        >
          <svg
            className={`h-8 w-8 ${iconColorClass}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            {icon}
          </svg>
        </div>
        <h1 className="mb-3 text-2xl font-semibold text-zinc-900">{title}</h1>
        <p className="text-lg text-zinc-600">{message}</p>
        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
}
