"use client";

import { useEffect, useRef, useCallback } from "react";

export interface KeyboardShortcutMap {
  [key: string]: () => void;
}

/**
 * Register global keyboard shortcuts for the studio.
 *
 * Automatically ignores keypresses when the user is typing in an
 * input, textarea, select, or contentEditable element. Also skips
 * Cmd/Ctrl combinations to avoid conflicts with browser shortcuts.
 *
 * @param shortcuts - Map of key names to handler functions
 * @param options.disabled - When true, all shortcuts are suspended
 *
 * @example
 * ```tsx
 * useKeyboardShortcuts({
 *   "1": () => activateScene(scenes[0]),
 *   " ": () => clearScreen(),
 *   "Escape": () => clearScreen(),
 * }, { disabled: dialogIsOpen });
 * ```
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcutMap,
  options?: { disabled?: boolean },
): void {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const disabledRef = useRef(options?.disabled ?? false);
  disabledRef.current = options?.disabled ?? false;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (disabledRef.current) return;

    // Ignore keypresses when typing in form fields
    const target = e.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable
    ) {
      return;
    }

    // Don't intercept Cmd/Ctrl combinations (browser shortcuts)
    if (e.metaKey || e.ctrlKey) return;

    const handler = shortcutsRef.current[e.key];
    if (handler) {
      e.preventDefault();
      handler();
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
