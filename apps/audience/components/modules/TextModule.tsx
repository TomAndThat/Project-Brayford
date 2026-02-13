"use client";

import type { TextModuleConfig } from "@brayford/core";

interface TextModuleProps {
  config: TextModuleConfig;
}

/**
 * Text module component for audience view
 *
 * Displays static text content as configured in the scene.
 * Respects the parent container's text colour from brand styling.
 */
export default function TextModule({ config }: TextModuleProps) {
  return (
    <div className="w-full px-6 py-4">
      <p className="text-base leading-relaxed whitespace-pre-wrap break-words">
        {config.content}
      </p>
    </div>
  );
}
