"use client";

import { useState } from "react";
import { getOrCreateUUID } from "@/lib/uuid";
import type { MessagingModuleConfig, InteractiveStyles } from "@brayford/core";
import {
  MAX_MESSAGE_CONTENT_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
} from "@brayford/core";

interface MessagingModuleProps {
  config: MessagingModuleConfig;
  eventId: string;
  /** Resolved interactive element styles (module override → brand → default) */
  styles: InteractiveStyles;
}

type FormStatus = "idle" | "submitting" | "success" | "error";

/**
 * Messaging module component for audience view
 *
 * Renders a message submission form configured with the scene's prompt text.
 * Submitted messages are routed to the event's moderation board.
 *
 * Rate limiting is enforced server-side (MESSAGE_RATE_LIMIT_SECONDS).
 * If the audience member submits too quickly they receive an inline
 * error — no visible countdown timer is shown.
 *
 * When `config.isOpen` is false the form is replaced by a notice so
 * creators can pause submissions without switching scenes.
 */
export default function MessagingModule({
  config,
  eventId,
  styles,
}: MessagingModuleProps) {
  const [content, setContent] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [contentEmpty, setContentEmpty] = useState(false);

  const inputStyle: React.CSSProperties = {
    backgroundColor: styles.inputBackgroundColor,
    color: styles.inputTextColor,
  };
  const buttonStyle: React.CSSProperties = {
    backgroundColor: styles.buttonBackgroundColor,
    color: styles.buttonTextColor,
  };

  const charactersRemaining = MAX_MESSAGE_CONTENT_LENGTH - content.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "submitting") return;

    if (!content.trim()) {
      setContentEmpty(true);
      return;
    }

    setStatus("submitting");
    setErrorMessage(null);

    try {
      const audienceUUID = getOrCreateUUID();

      const response = await fetch("/api/audience/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          audienceUUID,
          content: content.trim(),
          displayName: displayName.trim() || undefined,
        }),
      });

      if (response.status === 429) {
        const data = await response.json().catch(() => ({}));
        setErrorMessage(
          data.error ?? "Please wait a moment before sending another message.",
        );
        setStatus("error");
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setErrorMessage(
          data.error ?? "Something went wrong. Please try again.",
        );
        setStatus("error");
        return;
      }

      setStatus("success");
      setContent("");
      setDisplayName("");
      // Reset to idle after 4 s so the audience member can send again if needed
      setTimeout(() => setStatus("idle"), 4000);
    } catch {
      setErrorMessage(
        "Something went wrong. Please check your connection and try again.",
      );
      setStatus("error");
    }
  };

  // Module is closed — show a non-interactive notice
  if (!config.isOpen) {
    return (
      <div className="w-full px-6 py-4">
        {config.prompt && (
          <p className="text-base font-semibold mb-4">{config.prompt}</p>
        )}
        <div className="rounded-xl border border-current/20 p-5">
          <p className="text-sm opacity-60 text-center">
            Messages are not currently being accepted.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-6 py-4">
      {config.prompt && (
        <p className="text-base font-semibold mb-4">{config.prompt}</p>
      )}

      {status === "success" ? (
        <div className="rounded-xl border border-current/20 p-6 flex flex-col items-center gap-3 text-center">
          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div>
            <p className="font-semibold">Message sent!</p>
            <p className="text-sm opacity-70 mt-0.5">
              Thanks for your message.
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Optional display name */}
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={MAX_DISPLAY_NAME_LENGTH}
            placeholder="Your name (optional)"
            style={inputStyle}
            className="w-full rounded-lg border border-current/20 px-3 py-2.5 text-sm placeholder:opacity-40 focus:outline-none focus:ring-2 focus:ring-current/30"
          />

          {/* Message content */}
          <div>
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (contentEmpty && e.target.value.trim())
                  setContentEmpty(false);
              }}
              maxLength={MAX_MESSAGE_CONTENT_LENGTH}
              rows={4}
              placeholder="Type your message…"
              style={inputStyle}
              className={`w-full rounded-lg border px-3 py-2.5 text-sm placeholder:opacity-40 focus:outline-none focus:ring-2 resize-none ${
                contentEmpty
                  ? "border-red-400 focus:ring-red-400/50"
                  : "border-current/20 focus:ring-current/30"
              }`}
            />
            <p
              className={`text-xs mt-1 text-right transition-opacity ${
                charactersRemaining < 50 ? "opacity-100" : "opacity-50"
              }`}
            >
              {charactersRemaining} characters remaining
            </p>
          </div>

          {/* Inline errors */}
          {contentEmpty && (
            <p className="text-sm text-red-500">
              Please enter a message before sending.
            </p>
          )}
          {status === "error" && errorMessage && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={status === "submitting"}
            style={buttonStyle}
            className="w-full rounded-lg border border-current/20 hover:opacity-90 active:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-semibold transition-opacity cursor-pointer"
          >
            {status === "submitting" ? "Sending…" : "Send Message"}
          </button>
        </form>
      )}
    </div>
  );
}
