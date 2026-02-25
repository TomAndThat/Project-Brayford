/**
 * Module Config Schemas - Interaction Domain
 *
 * Zod validation schemas for each module type's configuration.
 * Used to safely parse `Record<string, unknown>` config data from Firestore
 * into strongly-typed module config objects.
 *
 * Each schema mirrors its corresponding interface in `types/module.ts`.
 *
 * @see types/module.ts for the TypeScript interfaces
 * @see schemas/scene.schema.ts for the parent ModuleInstance schema
 */

import { z } from 'zod';
import type {
  TextModuleConfig,
  ImageModuleConfig,
  MessagingModuleConfig,
  ModuleConfig,
} from '../types/module';

// ===== Individual Module Config Schemas =====

/**
 * Zod schema for TextModuleConfig
 *
 * Validates text module configuration including rich text content.
 * Content is stored as structured JSON (e.g., Tiptap JSONContent format).
 */
export const TextModuleConfigSchema = z.object({
  moduleType: z.literal('text'),
  content: z.record(z.unknown()),
});

/**
 * Zod schema for ImageModuleConfig
 *
 * Validates image module configuration including pre-resolved URLs
 * and accessibility metadata. The imageId is validated as a non-empty
 * string; the branded ImageId type is applied via the type cast in
 * the parse helper.
 */
export const ImageModuleConfigSchema = z.object({
  moduleType: z.literal('image'),
  imageId: z.string().min(1),
  url: z.string().url(),
  altText: z.string(),
  caption: z.string().optional(),
  fullWidth: z.boolean(),
});

/**
 * Zod schema for MessagingModuleConfig
 *
 * Validates messaging module configuration including prompt text,
 * open/closed state, and optional style overrides.
 */
export const MessagingModuleConfigSchema = z.object({
  moduleType: z.literal('messaging'),
  prompt: z.string(),
  isOpen: z.boolean(),
  styleOverrides: z.object({
    inputBackgroundColor: z.string().optional(),
    inputTextColor: z.string().optional(),
    buttonBackgroundColor: z.string().optional(),
    buttonTextColor: z.string().optional(),
  }).optional(),
});

// ===== Discriminated Union Schema =====

/**
 * Combined module config schema using discriminated union on `moduleType`.
 *
 * Automatically selects the correct sub-schema based on the `moduleType`
 * field, providing both runtime validation and TypeScript narrowing.
 */
export const ModuleConfigSchema = z.discriminatedUnion(
  'moduleType',
  [TextModuleConfigSchema, ImageModuleConfigSchema, MessagingModuleConfigSchema],
);

// ===== Validation Helpers =====

/**
 * Parse and validate raw module config data from Firestore.
 *
 * Returns the typed config on success, or `null` on validation failure.
 * Logs a warning on failure to aid debugging without breaking the UI.
 *
 * The cast to `ModuleConfig` is safe here because Zod has validated all
 * required fields; branded ID types (e.g., ImageId) are compile-time
 * markers that don't affect runtime shape.
 *
 * @param moduleType - The module type (used for error context)
 * @param config - Raw config data from Firestore (`Record<string, unknown>`)
 * @returns Validated and typed module config, or null
 */
export function parseModuleConfig(
  moduleType: string,
  config: Record<string, unknown>,
): ModuleConfig | null {
  const result = ModuleConfigSchema.safeParse({ ...config, moduleType });
  if (!result.success) {
    console.warn(
      `Invalid ${moduleType} module config:`,
      result.error.flatten().fieldErrors,
    );
    return null;
  }
  // Safe cast: Zod has validated the shape; branded types are compile-time only
  return result.data as unknown as ModuleConfig;
}
