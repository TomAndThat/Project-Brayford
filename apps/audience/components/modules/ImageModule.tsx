import type { ImageModuleConfig } from "@brayford/core";

interface ImageModuleProps {
  config: ImageModuleConfig;
}

/**
 * Image module component for audience view
 *
 * Renders a single full-width image with optional caption.
 * By default the image uses the same horizontal padding as text modules
 * (px-6) so it sits neatly within the content flow. When `fullWidth` is
 * true the image extends edge-to-edge — useful for hero imagery or
 * backgrounds that need to bleed to the screen edge.
 *
 * The caption, if set, always retains px-6 padding regardless of the
 * fullWidth setting so it never butts hard against the screen edge.
 */
export default function ImageModule({ config }: ImageModuleProps) {
  const { url, altText, caption, fullWidth } = config;

  return (
    <div className="w-full py-2">
      <div className={fullWidth ? "w-full" : "w-full px-6"}>
        <img src={url} alt={altText} className="w-full h-auto" loading="lazy" />
      </div>
      {caption && (
        <p className="px-6 pt-2 text-sm text-center opacity-70">{caption}</p>
      )}
    </div>
  );
}
