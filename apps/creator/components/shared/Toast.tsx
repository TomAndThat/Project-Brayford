"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

type ToastVariant = "error" | "success" | "warning" | "info";

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  /** Auto-dismiss after this many milliseconds. 0 = manual dismiss only. */
  durationMs: number;
}

interface ToastContextValue {
  /** Show a toast notification. Returns the toast ID for manual dismissal. */
  showToast: (
    message: string,
    options?: { variant?: ToastVariant; durationMs?: number },
  ) => string;
  /** Manually dismiss a toast by ID. */
  dismissToast: (id: string) => void;
}

// ────────────────────────────────────────────────────────────────────────────
// Context
// ────────────────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Hook to show non-blocking toast notifications.
 *
 * Must be used within a `<ToastProvider>`.
 *
 * @example
 * ```tsx
 * const { showToast } = useToast();
 * showToast("Changes saved", { variant: "success" });
 * showToast("Something went wrong", { variant: "error" });
 * ```
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

// ────────────────────────────────────────────────────────────────────────────
// Variant styling
// ────────────────────────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<
  ToastVariant,
  { container: string; icon: string; iconPath: string }
> = {
  error: {
    container: "bg-red-50 border-red-300 text-red-800",
    icon: "text-red-400",
    iconPath:
      "M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z",
  },
  success: {
    container: "bg-green-50 border-green-300 text-green-800",
    icon: "text-green-400",
    iconPath:
      "M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z",
  },
  warning: {
    container: "bg-amber-50 border-amber-300 text-amber-800",
    icon: "text-amber-400",
    iconPath:
      "M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z",
  },
  info: {
    container: "bg-blue-50 border-blue-300 text-blue-800",
    icon: "text-blue-400",
    iconPath:
      "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z",
  },
};

const DEFAULT_DURATION_MS = 5000;

// ────────────────────────────────────────────────────────────────────────────
// Provider
// ────────────────────────────────────────────────────────────────────────────

/**
 * Provides toast notification capabilities to the component tree.
 *
 * Place this near the root of the app (e.g. in the root layout client wrapper).
 * Toasts render in a fixed position at the top-right of the viewport.
 */
export function ToastProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counterRef = useRef(0);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (
      message: string,
      options?: { variant?: ToastVariant; durationMs?: number },
    ): string => {
      counterRef.current += 1;
      const id = `toast-${counterRef.current}-${Date.now()}`;
      const toast: ToastItem = {
        id,
        message,
        variant: options?.variant ?? "info",
        durationMs: options?.durationMs ?? DEFAULT_DURATION_MS,
      };
      setToasts((prev) => [...prev, toast]);
      return id;
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Toast container & individual toast
// ────────────────────────────────────────────────────────────────────────────

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}): React.ReactElement | null {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed top-4 right-4 z-[100] flex flex-col gap-3 w-full max-w-sm pointer-events-none"
    >
      {toasts.map((toast) => (
        <ToastNotification key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastNotification({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}): React.ReactElement {
  const style = VARIANT_STYLES[toast.variant];

  // Auto-dismiss timer
  useEffect(() => {
    if (toast.durationMs <= 0) return;

    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.durationMs);

    return () => clearTimeout(timer);
  }, [toast.id, toast.durationMs, onDismiss]);

  return (
    <div
      role="alert"
      className={`pointer-events-auto rounded-lg border px-4 py-3 shadow-lg animate-in slide-in-from-right-full fade-in duration-300 ${style.container}`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <svg
          className={`h-5 w-5 flex-shrink-0 mt-0.5 ${style.icon}`}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path fillRule="evenodd" d={style.iconPath} clipRule="evenodd" />
        </svg>

        {/* Message */}
        <p className="text-sm font-medium flex-1">{toast.message}</p>

        {/* Dismiss button */}
        <button
          onClick={() => onDismiss(toast.id)}
          className="flex-shrink-0 -mr-1 -mt-1 p-1 rounded-md hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-current"
          aria-label="Dismiss notification"
        >
          <svg
            className="h-4 w-4"
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
  );
}
