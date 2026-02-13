"use client";

import type { EventDocument } from "@brayford/core";

interface PreviewModule {
  id: string;
  moduleType: string;
  order: number;
  config: Record<string, unknown>;
}

interface PreviewScene {
  id: string;
  name: string;
  modules: PreviewModule[];
}

interface ScenePreviewPanelProps {
  event: EventDocument;
  activeScene: PreviewScene | null;
  loading: boolean;
}

/**
 * Simulated audience device preview.
 *
 * Renders a phone-frame representation of what audience members
 * currently see. Updates in real-time as the active scene changes.
 */
export default function ScenePreviewPanel({
  event,
  activeScene,
  loading,
}: ScenePreviewPanelProps) {
  if (loading) {
    return (
      <div className="flex flex-col h-full bg-gray-950 border-l border-gray-800">
        <div className="px-4 py-3 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            Audience Preview
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-950 border-l border-gray-800">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Audience Preview
        </h3>
        {activeScene ? (
          <p className="mt-0.5 text-xs text-gray-500 truncate">
            {activeScene.name}
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-gray-600">No scene active</p>
        )}
      </div>

      {/* Phone frame preview */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[280px] aspect-[9/16] rounded-[2rem] border-4 border-gray-700 bg-gray-900 overflow-hidden flex flex-col shadow-2xl">
          {/* Notch / status bar simulation */}
          <div className="h-7 bg-gray-800 flex items-center justify-center">
            <div className="w-20 h-1.5 rounded-full bg-gray-700" />
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto p-4">
            {!activeScene ? (
              <NoSceneState eventName={event.name} />
            ) : activeScene.modules.length === 0 ? (
              <EmptySceneState />
            ) : (
              <div className="space-y-3">
                {[...activeScene.modules]
                  .sort((a, b) => a.order - b.order)
                  .map((mod) => (
                    <ModulePreview key={mod.id} module={mod} />
                  ))}
              </div>
            )}
          </div>

          {/* Bottom home indicator */}
          <div className="h-5 bg-gray-800 flex items-center justify-center">
            <div className="w-24 h-1 rounded-full bg-gray-700" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** What audience sees when no scene is active */
function NoSceneState({ eventName }: { eventName: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="h-12 w-12 rounded-full bg-gray-800 flex items-center justify-center mb-3">
        <svg
          className="h-6 w-6 text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-400">{eventName}</p>
      <p className="text-xs text-gray-600 mt-1">
        Waiting for the show to start…
      </p>
    </div>
  );
}

/** What audience sees when the active scene has no modules */
function EmptySceneState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <p className="text-sm text-gray-500">Empty scene</p>
      <p className="text-xs text-gray-600 mt-1">No modules in this scene</p>
    </div>
  );
}

/**
 * Render a single module in the preview panel.
 *
 * As new module types are added, add rendering cases here.
 */
function ModulePreview({ module }: { module: PreviewModule }) {
  switch (module.moduleType) {
    case "text":
      return (
        <div className="rounded-lg bg-gray-800 p-3">
          <p className="text-sm text-gray-300 whitespace-pre-wrap">
            {typeof module.config.content === "string"
              ? module.config.content
              : "Text content"}
          </p>
        </div>
      );

    // Future module types will render appropriate previews:
    // case "poll": return <PollPreview config={module.config} />;
    // case "qna":  return <QnAPreview config={module.config} />;

    default:
      return (
        <div className="rounded-lg bg-gray-800 p-3 border border-dashed border-gray-700">
          <p className="text-xs text-gray-500 capitalize">
            {module.moduleType} module
          </p>
        </div>
      );
  }
}
