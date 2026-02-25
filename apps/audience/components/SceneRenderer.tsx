"use client";

import { useEffect, useState } from "react";
import {
  type SceneId,
  type SceneDocument,
  type ModuleInstance,
  type InteractiveStyles,
  DEFAULT_INPUT_BACKGROUND,
  DEFAULT_INPUT_TEXT,
  DEFAULT_BUTTON_BACKGROUND,
  DEFAULT_BUTTON_TEXT,
  parseModuleConfig,
} from "@brayford/core";
import { getScene } from "@brayford/firebase-utils";
import TextModule from "./modules/TextModule";
import ImageModule from "./modules/ImageModule";
import MessagingModule from "./modules/MessagingModule";

interface SceneRendererProps {
  sceneId: SceneId;
  eventName: string;
  eventId: string;
  /** Brand-level interactive element styling (input + button colours) */
  brandInputBackgroundColor?: string;
  brandInputTextColor?: string;
  brandButtonBackgroundColor?: string;
  brandButtonTextColor?: string;
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
  eventId,
  brandInputBackgroundColor,
  brandInputTextColor,
  brandButtonBackgroundColor,
  brandButtonTextColor,
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

  // Build brand-level interactive styles (fallback to hardcoded defaults)
  const brandStyles: InteractiveStyles = {
    inputBackgroundColor: brandInputBackgroundColor || DEFAULT_INPUT_BACKGROUND,
    inputTextColor: brandInputTextColor || DEFAULT_INPUT_TEXT,
    buttonBackgroundColor:
      brandButtonBackgroundColor || DEFAULT_BUTTON_BACKGROUND,
    buttonTextColor: brandButtonTextColor || DEFAULT_BUTTON_TEXT,
  };

  return (
    <div className="w-full space-y-4 py-6">
      {sortedModules.map((module) => (
        <ModuleRenderer
          key={module.id}
          module={module}
          eventId={eventId}
          brandStyles={brandStyles}
        />
      ))}
    </div>
  );
}

/**
 * Renders an individual module based on its type
 *
 * Extensible: add new module type cases as they're implemented.
 */
function ModuleRenderer({
  module,
  eventId,
  brandStyles,
}: {
  module: ModuleInstance;
  eventId: string;
  brandStyles: InteractiveStyles;
}) {
  const config = parseModuleConfig(module.moduleType, module.config);
  if (!config) {
    // Invalid config — skip silently (warning already logged by parseModuleConfig)
    return null;
  }

  switch (config.moduleType) {
    case "text":
      return <TextModule config={config} />;

    case "image":
      return <ImageModule config={config} />;

    case "messaging": {
      // Resolve: module override → brand style → default (already in brandStyles)
      const resolvedStyles: InteractiveStyles = {
        inputBackgroundColor:
          config.styleOverrides?.inputBackgroundColor ||
          brandStyles.inputBackgroundColor,
        inputTextColor:
          config.styleOverrides?.inputTextColor || brandStyles.inputTextColor,
        buttonBackgroundColor:
          config.styleOverrides?.buttonBackgroundColor ||
          brandStyles.buttonBackgroundColor,
        buttonTextColor:
          config.styleOverrides?.buttonTextColor || brandStyles.buttonTextColor,
      };
      return (
        <MessagingModule
          config={config}
          eventId={eventId}
          styles={resolvedStyles}
        />
      );
    }

    default:
      // Unknown module types are silently skipped
      return null;
  }
}
