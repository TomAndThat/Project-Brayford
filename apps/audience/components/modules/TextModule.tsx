"use client";

import type { TextModuleConfig } from "@brayford/core";
import type { JSONContent } from "@tiptap/react";
import RichTextRenderer from "../RichTextRenderer";

interface TextModuleProps {
  config: TextModuleConfig;
}

/**
 * Text module component for audience view
 *
 * Displays rich text content as configured in the scene.
 * Supports full formatting including headings, lists, links, colors, etc.
 * Respects the parent container's text color from brand styling.
 */
export default function TextModule({ config }: TextModuleProps) {
  // Handle both legacy string content and new JSONContent format
  const content = config.content as JSONContent | string;

  return (
    <div className="w-full px-6 py-4">
      <RichTextRenderer content={content} className="text-base" />
    </div>
  );
}
