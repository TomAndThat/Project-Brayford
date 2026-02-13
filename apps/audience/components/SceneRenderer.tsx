"use client";

import { useEffect, useState } from "react";
import {
  type SceneId,
  type SceneDocument,
  type ModuleInstance,
} from "@brayford/core";
import { getScene } from "@brayford/firebase-utils";
import TextModule from "./modules/TextModule";

interface SceneRendererProps {
  sceneId: SceneId;
  eventName: string;
}

/**
 * Scene renderer for audience view
 *
 * Fetches and displays the active scene's modules in order.
 * Handles loading states and falls back silently on errors.
 *
 * Keeps previous scene visible while loading new scenes to prevent flash.
 * Modules are sorted by their order property and rendered
 * using type-specific components.
 */
export default function SceneRenderer({
  sceneId,
  eventName,
}: SceneRendererProps) {
  const [displayedScene, setDisplayedScene] = useState<SceneDocument | null>(
    null,
  );
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchScene() {
      try {
        const sceneData = await getScene(sceneId);

        if (!mounted) return;

        if (sceneData) {
          setDisplayedScene(sceneData);
        } else {
          // Scene not found - silent fallback
          if (isInitialLoad) {
            setDisplayedScene(null);
          }
          // Keep previous scene visible if new one fails to load
        }
      } catch (error) {
        // Network error or permission issue - silent fallback
        console.error("Failed to load scene:", error);
        // Keep previous scene visible on error (don't clear displayedScene)
      } finally {
        if (mounted) {
          setIsInitialLoad(false);
        }
      }
    }

    fetchScene();

    return () => {
      mounted = false;
    };
  }, [sceneId, isInitialLoad]);

  // Return nothing until scene is loaded - parent's transition handles the visual feedback
  if (!displayedScene || displayedScene.modules.length === 0) {
    return null;
  }

  // Sort modules by order and render
  const sortedModules = [...displayedScene.modules].sort(
    (a, b) => a.order - b.order,
  );

  return (
    <div className="w-full space-y-4 py-6">
      {sortedModules.map((module) => (
        <ModuleRenderer key={module.id} module={module} />
      ))}
    </div>
  );
}

/**
 * Renders an individual module based on its type
 *
 * Extensible: add new module type cases as they're implemented.
 */
function ModuleRenderer({ module }: { module: ModuleInstance }) {
  switch (module.moduleType) {
    case "text":
      return <TextModule config={module.config as any} />;

    default:
      // Unknown module types are silently skipped
      return null;
  }
}
