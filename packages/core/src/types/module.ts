/**
 * Module Type Definitions - Interaction Domain
 * 
 * Type-safe definitions for all content modules that can be placed in scenes.
 * Module types are extensible - add new types here as new modules are developed.
 * 
 * Each module type has a corresponding config interface that defines
 * its specific settings. The config is stored as part of the module
 * instance embedded within scene documents.
 */

/**
 * All available module types.
 * 
 * Add new entries here when developing new modules.
 * Each entry should have a corresponding config interface below.
 */
export type ModuleType = 'text' | 'image' | 'messaging';

/**
 * Array of all valid module type values.
 * Kept in sync with the ModuleType union above for runtime validation.
 */
export const MODULE_TYPES: ModuleType[] = ['text', 'image', 'messaging'] as const;

// ===== Module Config Interfaces =====

/**
 * Text module configuration
 * 
 * Rich text content display - the most basic building block for scenes.
 * Allows users to add formatted text content to their scenes.
 * Content is stored as structured JSON (e.g., Tiptap JSONContent format).
 */
export interface TextModuleConfig {
  readonly moduleType: 'text';
  /** The rich text content to display (JSON structure) */
  content: Record<string, unknown> | unknown;
}

/**
 * Image module configuration
 *
 * Full-width image display. The URL is the pre-resolved display-variant
 * (1000px WebP) baked in at save time so the audience app requires no
 * extra Firestore round-trip per image.
 *
 * fullWidth: false (default) applies the same horizontal padding as text
 * modules; true extends the image edge-to-edge.
 */
export interface ImageModuleConfig {
  readonly moduleType: 'image';
  /** ID of the image document in the organisation's image library */
  imageId: string;
  /** Pre-resolved display-variant URL (1000px WebP) */
  url: string;
  /** Accessibility label — shown if image fails to load */
  altText: string;
  /** Optional caption rendered below the image */
  caption?: string;
  /** When true, image extends to screen edges (no horizontal padding) */
  fullWidth: boolean;
}

/**
 * Messaging module configuration
 *
 * Audience-facing message submission form. Submitted messages are routed
 * to the event's moderation board (message columns) in the creator console.
 */
export interface MessagingModuleConfig {
  readonly moduleType: 'messaging';
  /** Prompt shown above the message input on audience devices */
  prompt: string;
  /** Whether the module is currently accepting new submissions */
  isOpen: boolean;
  /** Optional per-module style overrides (take priority over brand defaults) */
  styleOverrides?: {
    inputBackgroundColor?: string;
    inputTextColor?: string;
    buttonBackgroundColor?: string;
    buttonTextColor?: string;
  };
}

// ===== Discriminated Union =====

/**
 * Union type for all module configurations.
 * 
 * Uses discriminated union via the `moduleType` field, enabling
 * TypeScript to narrow the type based on the moduleType value:
 * 
 * @example
 * ```ts
 * function renderModule(config: ModuleConfig) {
 *   switch (config.moduleType) {
 *     case 'text':
 *       return <TextDisplay content={config.content} />; // TypeScript knows this is TextModuleConfig
 *   }
 * }
 * ```
 */
export type ModuleConfig = TextModuleConfig | ImageModuleConfig | MessagingModuleConfig;
