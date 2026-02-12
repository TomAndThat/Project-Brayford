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
export type ModuleType = 'text';

/**
 * Array of all valid module type values.
 * Kept in sync with the ModuleType union above for runtime validation.
 */
export const MODULE_TYPES: ModuleType[] = ['text'] as const;

// ===== Module Config Interfaces =====

/**
 * Text module configuration
 * 
 * Simple text content display - the most basic building block for scenes.
 * Allows users to add arbitrary text content to their scenes.
 */
export interface TextModuleConfig {
  readonly moduleType: 'text';
  /** The text content to display */
  content: string;
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
export type ModuleConfig = TextModuleConfig;
