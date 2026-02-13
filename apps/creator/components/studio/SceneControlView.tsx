"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type EventDocument, fromBranded } from "@brayford/core";
import { useEventLiveState, auth } from "@brayford/firebase-utils";
import { useStudioPreferences } from "@/hooks/use-studio-preferences";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import SceneCard from "./SceneCard";
import ScenePreviewPanel from "./ScenePreviewPanel";
import SceneSwitchConfirmDialog from "./SceneSwitchConfirmDialog";
import ModuleControlsDrawer from "./ModuleControlsDrawer";

// ===== Types =====

interface ApiScene {
  id: string;
  name: string;
  description?: string;
  modules: Array<{
    id: string;
    moduleType: string;
    order: number;
    config: Record<string, unknown>;
  }>;
  organizationId: string;
  brandId: string | null;
  eventId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface ConfirmDialogState {
  isOpen: boolean;
  sceneId: string | null;
  sceneName: string;
  isClearAction: boolean;
}

const CONFIRM_DIALOG_CLOSED: ConfirmDialogState = {
  isOpen: false,
  sceneId: null,
  sceneName: "",
  isClearAction: false,
};

/** Auto-dismiss error messages after this many milliseconds */
const SWITCH_ERROR_DISMISS_MS = 5000;

// ===== Component =====

interface SceneControlViewProps {
  event: EventDocument;
}

/**
 * Main scene control interface for the studio.
 *
 * Orchestrates:
 * - Real-time live state subscription (what's currently active)
 * - Scene list loading from API
 * - Scene switching with optional confirmation
 * - Keyboard shortcuts (1–9 for scenes, Space/Escape to clear)
 * - Audience preview panel
 * - Module controls drawer
 */
export default function SceneControlView({ event }: SceneControlViewProps) {
  const eventId = event.id;
  const {
    liveState,
    loading: liveStateLoading,
    error: liveStateError,
  } = useEventLiveState(eventId);
  const { preferences, updatePreference } = useStudioPreferences();

  // Scenes list
  const [scenes, setScenes] = useState<ApiScene[]>([]);
  const [scenesLoading, setScenesLoading] = useState(true);
  const [scenesError, setScenesError] = useState<string | null>(null);

  // Scene switching
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  // Confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(
    CONFIRM_DIALOG_CLOSED,
  );

  // Module controls drawer
  const [drawerSceneId, setDrawerSceneId] = useState<string | null>(null);

  // Derive active scene ID from real-time live state
  const activeSceneId = liveState?.activeSceneId
    ? fromBranded(liveState.activeSceneId)
    : null;

  // Resolve active scene data for preview
  const activeScene = useMemo(
    () => scenes.find((s) => s.id === activeSceneId) ?? null,
    [scenes, activeSceneId],
  );

  // Resolve drawer scene data
  const drawerScene = useMemo(
    () => scenes.find((s) => s.id === drawerSceneId) ?? null,
    [scenes, drawerSceneId],
  );

  // ===== Auto-dismiss switch errors =====

  useEffect(() => {
    if (!switchError) return;
    const timer = setTimeout(
      () => setSwitchError(null),
      SWITCH_ERROR_DISMISS_MS,
    );
    return () => clearTimeout(timer);
  }, [switchError]);

  // ===== Fetch Scenes =====

  const fetchScenes = useCallback(async () => {
    try {
      setScenesLoading(true);
      setScenesError(null);

      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");

      const res = await fetch(`/api/events/${fromBranded(eventId)}/scenes`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load scenes");
      }

      const { scenes: scenesData } = await res.json();
      setScenes(scenesData);
    } catch (err) {
      console.error("Error fetching scenes:", err);
      setScenesError(
        err instanceof Error ? err.message : "Failed to load scenes",
      );
    } finally {
      setScenesLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchScenes();
  }, [fetchScenes]);

  // ===== Initialise Live State =====

  useEffect(() => {
    async function initLiveState() {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) return;

        await fetch(`/api/events/${fromBranded(eventId)}/live-state`, {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
        });
      } catch (err) {
        console.error("Error initialising live state:", err);
      }
    }

    initLiveState();
  }, [eventId]);

  // ===== Scene Switching =====

  const performSwitch = useCallback(
    async (sceneId: string | null) => {
      try {
        setSwitching(true);
        setSwitchError(null);

        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error("Not authenticated");

        const res = await fetch(
          `/api/events/${fromBranded(eventId)}/live-state`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${idToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "switchScene",
              sceneId,
            }),
          },
        );

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to switch scene");
        }
      } catch (err) {
        console.error("Error switching scene:", err);
        setSwitchError(
          err instanceof Error ? err.message : "Failed to switch scene",
        );
      } finally {
        setSwitching(false);
      }
    },
    [eventId],
  );

  const handleSceneActivate = useCallback(
    (sceneId: string) => {
      // Don't re-switch to the already-active scene
      if (sceneId === activeSceneId) return;

      const scene = scenes.find((s) => s.id === sceneId);
      if (!scene) return;

      if (preferences.requireSceneSwitchConfirmation) {
        setConfirmDialog({
          isOpen: true,
          sceneId,
          sceneName: scene.name,
          isClearAction: false,
        });
      } else {
        performSwitch(sceneId);
      }
    },
    [
      activeSceneId,
      scenes,
      preferences.requireSceneSwitchConfirmation,
      performSwitch,
    ],
  );

  const handleClearScreen = useCallback(() => {
    // Already cleared
    if (!activeSceneId) return;

    if (preferences.requireSceneSwitchConfirmation) {
      setConfirmDialog({
        isOpen: true,
        sceneId: null,
        sceneName: "",
        isClearAction: true,
      });
    } else {
      performSwitch(null);
    }
  }, [
    activeSceneId,
    preferences.requireSceneSwitchConfirmation,
    performSwitch,
  ]);

  const handleConfirmSwitch = useCallback(() => {
    performSwitch(confirmDialog.sceneId);
    setConfirmDialog(CONFIRM_DIALOG_CLOSED);
  }, [confirmDialog.sceneId, performSwitch]);

  const handleCancelSwitch = useCallback(() => {
    setConfirmDialog(CONFIRM_DIALOG_CLOSED);
  }, []);

  // ===== Module Controls Drawer =====

  const handleOpenModuleControls = useCallback((sceneId: string) => {
    setDrawerSceneId(sceneId);
  }, []);

  const handleCloseModuleControls = useCallback(() => {
    setDrawerSceneId(null);
  }, []);

  const handleModuleConfigUpdate = useCallback(
    async (
      sceneId: string,
      moduleId: string,
      config: Record<string, unknown>,
    ) => {
      // TODO: Implement module config updates via API
      // 1. PATCH /api/scenes/[sceneId] with updated module config
      // 2. If scene is active, call markContentUpdated on the live state
      console.warn("Module config update not yet implemented:", {
        sceneId,
        moduleId,
        config,
      });
    },
    [],
  );

  // ===== Keyboard Shortcuts =====

  const shortcuts = useMemo(() => {
    const map: Record<string, () => void> = {};

    // 1-9: switch to scene by position
    scenes.slice(0, 9).forEach((scene, i) => {
      map[String(i + 1)] = () => handleSceneActivate(scene.id);
    });

    // Space: clear screen
    map[" "] = handleClearScreen;

    // Escape: clear screen (emergency)
    map["Escape"] = handleClearScreen;

    return map;
  }, [scenes, handleSceneActivate, handleClearScreen]);

  // Disable keyboard shortcuts when confirmation dialog is open
  // (dialog handles its own Escape/Enter keys via capture phase)
  useKeyboardShortcuts(shortcuts, { disabled: confirmDialog.isOpen });

  // ===== Render =====

  const isLoading = liveStateLoading || scenesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-gray-400 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading scenes…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full">
        {/* Left: Scene list */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between border-b border-gray-800 px-6 py-3">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-white">Scenes</h2>
              {scenes.length > 0 && (
                <span className="text-sm text-gray-500">
                  {scenes.length} scene{scenes.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* Clear screen button */}
              <button
                onClick={handleClearScreen}
                disabled={!activeSceneId || switching}
                className="flex items-center gap-2 rounded-md border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  />
                </svg>
                Clear Screen
              </button>

              {/* Confirmation toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className="text-xs text-gray-400">
                  Confirm before switching
                </span>
                <button
                  role="switch"
                  aria-checked={preferences.requireSceneSwitchConfirmation}
                  onClick={() =>
                    updatePreference(
                      "requireSceneSwitchConfirmation",
                      !preferences.requireSceneSwitchConfirmation,
                    )
                  }
                  className={`
                    relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ease-in-out
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900
                    ${
                      preferences.requireSceneSwitchConfirmation
                        ? "bg-blue-600"
                        : "bg-gray-600"
                    }
                  `}
                >
                  <span
                    aria-hidden="true"
                    className={`
                      pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow
                      transform ring-0 transition-transform duration-200 ease-in-out
                      mt-0.5
                      ${
                        preferences.requireSceneSwitchConfirmation
                          ? "translate-x-[18px]"
                          : "translate-x-[2px]"
                      }
                    `}
                  />
                </button>
              </label>
            </div>
          </div>

          {/* Error display */}
          {(scenesError || liveStateError || switchError) && (
            <div className="mx-6 mt-4 rounded-md bg-red-500/10 border border-red-500/30 px-4 py-3">
              <p className="text-sm text-red-400">
                {scenesError || liveStateError?.message || switchError}
              </p>
              {scenesError && (
                <button
                  onClick={fetchScenes}
                  className="mt-2 text-xs text-red-300 underline hover:text-red-200"
                >
                  Try again
                </button>
              )}
            </div>
          )}

          {/* Scene list */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {scenes.length === 0 ? (
              <EmptySceneList />
            ) : (
              scenes.map((scene, index) => (
                <SceneCard
                  key={scene.id}
                  scene={scene}
                  isActive={scene.id === activeSceneId}
                  index={index}
                  isSwitching={switching}
                  onActivate={handleSceneActivate}
                  onOpenModuleControls={handleOpenModuleControls}
                />
              ))
            )}
          </div>

          {/* Keyboard shortcuts footer */}
          {scenes.length > 0 && (
            <div className="border-t border-gray-800 px-6 py-2 flex items-center gap-4 text-xs text-gray-600">
              <span>
                <kbd className="rounded bg-gray-800 px-1.5 py-0.5 font-mono text-gray-400">
                  1
                </kbd>
                –
                <kbd className="rounded bg-gray-800 px-1.5 py-0.5 font-mono text-gray-400">
                  9
                </kbd>{" "}
                Switch scene
              </span>
              <span>
                <kbd className="rounded bg-gray-800 px-1.5 py-0.5 font-mono text-gray-400">
                  Space
                </kbd>{" "}
                Clear screen
              </span>
              <span>
                <kbd className="rounded bg-gray-800 px-1.5 py-0.5 font-mono text-gray-400">
                  Esc
                </kbd>{" "}
                Emergency clear
              </span>
            </div>
          )}
        </div>

        {/* Right: Audience preview */}
        <div className="w-80 shrink-0">
          <ScenePreviewPanel
            event={event}
            activeScene={activeScene}
            loading={liveStateLoading}
          />
        </div>
      </div>

      {/* Confirmation dialog */}
      <SceneSwitchConfirmDialog
        isOpen={confirmDialog.isOpen}
        sceneName={confirmDialog.sceneName}
        isClearAction={confirmDialog.isClearAction}
        onConfirm={handleConfirmSwitch}
        onCancel={handleCancelSwitch}
      />

      {/* Module controls drawer */}
      <ModuleControlsDrawer
        isOpen={drawerSceneId !== null}
        scene={drawerScene}
        isSceneLive={drawerSceneId !== null && drawerSceneId === activeSceneId}
        onClose={handleCloseModuleControls}
        onModuleConfigUpdate={handleModuleConfigUpdate}
      />
    </>
  );
}

/** Empty state when no scenes exist for this event */
function EmptySceneList() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-12">
      <div className="h-16 w-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
        <svg
          className="h-8 w-8 text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-gray-300 mb-1">No scenes yet</h3>
      <p className="text-sm text-gray-500 max-w-xs">
        Create scenes for this event in the dashboard to control what your
        audience sees.
      </p>
    </div>
  );
}
