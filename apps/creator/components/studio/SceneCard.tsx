"use client";

interface SceneCardModule {
  id: string;
  moduleType: string;
  order: number;
}

interface SceneCardScene {
  id: string;
  name: string;
  description?: string;
  modules: SceneCardModule[];
}

interface SceneCardProps {
  scene: SceneCardScene;
  isActive: boolean;
  /** Zero-based position in the scene list (used for keyboard shortcut hint) */
  index: number;
  /** Whether a scene switch is currently in progress */
  isSwitching: boolean;
  onActivate: (sceneId: string) => void;
  onOpenModuleControls: (sceneId: string) => void;
}

/**
 * Individual scene card for the studio scene list.
 *
 * Shows the scene name, module type badges, a keyboard shortcut hint,
 * and actions for activating the scene and opening module controls.
 *
 * Active scene is clearly distinguished with a green border and LIVE badge.
 * Inactive scenes have a "Go Live" button.
 */
export default function SceneCard({
  scene,
  isActive,
  index,
  isSwitching,
  onActivate,
  onOpenModuleControls,
}: SceneCardProps) {
  const shortcutKey = index + 1 <= 9 ? String(index + 1) : null;

  return (
    <div
      className={`
        group relative rounded-lg border-2 transition-all
        ${
          isActive
            ? "border-green-500 bg-green-500/10"
            : "border-gray-700 bg-gray-800/50 hover:border-gray-500 hover:bg-gray-800"
        }
      `}
    >
      <div className="flex items-center gap-3 p-4">
        {/* Keyboard shortcut hint */}
        {shortcutKey && (
          <div
            className={`
              flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-mono font-bold
              ${
                isActive
                  ? "bg-green-500/20 text-green-400"
                  : "bg-gray-700 text-gray-400 group-hover:text-gray-300"
              }
            `}
          >
            {shortcutKey}
          </div>
        )}

        {/* Scene info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3
              className={`font-semibold truncate ${
                isActive ? "text-green-100" : "text-gray-200"
              }`}
            >
              {scene.name}
            </h3>
            {isActive && (
              <span className="flex items-center gap-1.5 shrink-0 rounded-full bg-green-500/20 px-2.5 py-0.5 text-xs font-semibold text-green-400">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                LIVE
              </span>
            )}
          </div>

          {/* Scene description */}
          {scene.description && (
            <p
              className={`mt-1 text-sm line-clamp-2 ${
                isActive ? "text-green-200/80" : "text-gray-400"
              }`}
            >
              {scene.description}
            </p>
          )}

          {/* Module type indicators */}
          {scene.modules.length > 0 ? (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {[...scene.modules]
                .sort((a, b) => a.order - b.order)
                .map((mod) => (
                  <span
                    key={mod.id}
                    className="rounded bg-gray-700 px-1.5 py-0.5 text-xs text-gray-400 capitalize"
                  >
                    {mod.moduleType}
                  </span>
                ))}
            </div>
          ) : (
            <p className="mt-1 text-xs text-gray-500 italic">No modules</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Module controls button */}
          {scene.modules.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenModuleControls(scene.id);
              }}
              className="rounded-md p-2 text-gray-500 hover:text-gray-300 hover:bg-gray-700 transition-colors"
              title="Module controls"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                />
              </svg>
            </button>
          )}

          {/* Activate / Go Live button */}
          {!isActive && (
            <button
              onClick={() => onActivate(scene.id)}
              disabled={isSwitching}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title={`Switch to ${scene.name}`}
            >
              Go Live
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
