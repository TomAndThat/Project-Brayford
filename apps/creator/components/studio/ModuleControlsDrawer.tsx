"use client";

interface DrawerModule {
  id: string;
  moduleType: string;
  order: number;
  config: Record<string, unknown>;
}

interface DrawerScene {
  id: string;
  name: string;
  modules: DrawerModule[];
}

interface ModuleControlsDrawerProps {
  isOpen: boolean;
  scene: DrawerScene | null;
  isSceneLive: boolean;
  onClose: () => void;
  onModuleConfigUpdate: (
    sceneId: string,
    moduleId: string,
    config: Record<string, unknown>,
  ) => void;
}

/**
 * Slide-out drawer for per-module live controls.
 *
 * Architecture is designed for extensibility: as new module types are added
 * (poll, Q&A, countdown, etc.), add a case to `renderModuleControls` with
 * that module's specific live controls.
 *
 * The drawer can be opened for any scene, but only modules in the
 * currently-live scene will have active controls (indicated by the
 * live banner).
 */
export default function ModuleControlsDrawer({
  isOpen,
  scene,
  isSceneLive,
  onClose,
  onModuleConfigUpdate,
}: ModuleControlsDrawerProps) {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`
          fixed right-0 top-0 z-50 h-full w-96 bg-gray-900 border-l border-gray-700
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {scene && (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-700 px-6 py-4">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-white">
                  Module Controls
                </h3>
                <p className="text-sm text-gray-400 mt-0.5 truncate">
                  {scene.name}
                </p>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 rounded-md p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Live status indicator */}
            {isSceneLive && (
              <div className="mx-6 mt-4 flex items-center gap-2 rounded-md bg-green-500/10 border border-green-500/30 px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-medium text-green-400">
                  This scene is currently live — changes affect all viewers
                </span>
              </div>
            )}

            {!isSceneLive && (
              <div className="mx-6 mt-4 flex items-center gap-2 rounded-md bg-gray-800 border border-gray-700 px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-gray-500" />
                <span className="text-xs font-medium text-gray-500">
                  This scene is not live — controls are view-only
                </span>
              </div>
            )}

            {/* Module list */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {scene.modules.length === 0 ? (
                <p className="text-sm text-gray-500 italic text-center py-8">
                  No modules in this scene
                </p>
              ) : (
                [...scene.modules]
                  .sort((a, b) => a.order - b.order)
                  .map((mod) => (
                    <ModuleControlPanel
                      key={mod.id}
                      module={mod}
                      isSceneLive={isSceneLive}
                      onConfigUpdate={(config) =>
                        onModuleConfigUpdate(scene.id, mod.id, config)
                      }
                    />
                  ))
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Per-module control panel.
 *
 * Renders type-specific controls for each module. As new module types
 * are added (poll, Q&A, countdown, etc.), add a case to the switch
 * with that module's live controls.
 */
function ModuleControlPanel({
  module,
  isSceneLive,
  onConfigUpdate,
}: {
  module: DrawerModule;
  isSceneLive: boolean;
  onConfigUpdate: (config: Record<string, unknown>) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50">
      {/* Module header */}
      <div className="flex items-center gap-3 border-b border-gray-700 px-4 py-3">
        <div className="rounded-md bg-gray-700 px-2 py-1">
          <span className="text-xs font-medium text-gray-300 capitalize">
            {module.moduleType}
          </span>
        </div>
      </div>

      {/* Module-specific controls */}
      <div className="px-4 py-3">
        {renderModuleControls(module, isSceneLive, onConfigUpdate)}
      </div>
    </div>
  );
}

/**
 * Render module-type-specific controls.
 *
 * Extension point: add new module types here as they are built.
 * Each module type should render appropriate live controls, e.g.:
 * - poll:      Open / Closed / Show Results toggle
 * - qna:       Accepting Questions / Viewing Only / Closed
 * - countdown: Start / Pause / Reset
 * - welcome:   (no live controls)
 */
function renderModuleControls(
  module: DrawerModule,
  _isSceneLive: boolean,
  _onConfigUpdate: (config: Record<string, unknown>) => void,
): JSX.Element {
  switch (module.moduleType) {
    case "text":
      return (
        <p className="text-xs text-gray-500">
          {typeof module.config.content === "string"
            ? module.config.content
            : "Text content"}
        </p>
      );

    // Future module types:
    //
    // case "poll":
    //   return (
    //     <PollModuleControls
    //       config={module.config}
    //       isLive={isSceneLive}
    //       onUpdate={onConfigUpdate}
    //     />
    //   );
    //
    // case "qna":
    //   return (
    //     <QnAModuleControls
    //       config={module.config}
    //       isLive={isSceneLive}
    //       onUpdate={onConfigUpdate}
    //     />
    //   );
    //
    // case "countdown":
    //   return (
    //     <CountdownModuleControls
    //       config={module.config}
    //       isLive={isSceneLive}
    //       onUpdate={onConfigUpdate}
    //     />
    //   );

    default:
      return (
        <p className="text-xs text-gray-500 italic">
          No live controls available for this module type
        </p>
      );
  }
}
