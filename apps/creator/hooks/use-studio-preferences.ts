"use client";

import { useState, useCallback, useEffect } from "react";

const PREFERENCES_KEY = "brayford:studio-preferences";

export interface StudioPreferences {
  /** When true, a confirmation dialog is shown before switching scenes */
  requireSceneSwitchConfirmation: boolean;
}

const DEFAULT_PREFERENCES: StudioPreferences = {
  requireSceneSwitchConfirmation: true,
};

function loadPreferences(): StudioPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;

  try {
    const stored = localStorage.getItem(PREFERENCES_KEY);
    if (!stored) return DEFAULT_PREFERENCES;

    const parsed = JSON.parse(stored);
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function savePreferences(preferences: StudioPreferences): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // localStorage may be unavailable (private browsing, full storage, etc.)
  }
}

/**
 * Manage per-user studio preferences stored in localStorage.
 *
 * Preferences persist across sessions but are local to the device.
 * They are user-level, not organisation-level, because confidence
 * and workflow preferences vary by individual.
 */
export function useStudioPreferences(): {
  preferences: StudioPreferences;
  updatePreference: <K extends keyof StudioPreferences>(
    key: K,
    value: StudioPreferences[K],
  ) => void;
} {
  const [preferences, setPreferences] =
    useState<StudioPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    setPreferences(loadPreferences());
  }, []);

  const updatePreference = useCallback(
    <K extends keyof StudioPreferences>(
      key: K,
      value: StudioPreferences[K],
    ) => {
      setPreferences((prev) => {
        const next = { ...prev, [key]: value };
        savePreferences(next);
        return next;
      });
    },
    [],
  );

  return { preferences, updatePreference };
}
