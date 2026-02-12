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
export type ModuleType =
  | 'welcome'
  | 'qna'
  | 'poll'
  | 'countdown'
  | 'sponsor';

/**
 * Array of all valid module type values.
 * Kept in sync with the ModuleType union above for runtime validation.
 */
export const MODULE_TYPES: ModuleType[] = [
  'welcome',
  'qna',
  'poll',
  'countdown',
  'sponsor',
] as const;

// ===== Module Config Interfaces =====

/**
 * Welcome module configuration
 * 
 * Static content display for pre-event or intermission screens.
 * Supports a title, body message, and optional background colour override.
 */
export interface WelcomeModuleConfig {
  readonly moduleType: 'welcome';
  title: string;
  message: string;
  backgroundColor?: string;
}

/**
 * Q&A module configuration
 * 
 * Allows audience to submit questions. Links to a separate Q&A session
 * document for storing the actual questions and moderation state.
 */
export interface QnaModuleConfig {
  readonly moduleType: 'qna';
  /** Reference to Q&A session document (when Q&A module is implemented) */
  sessionId?: string;
  /** Controls what the audience sees: submit form, live feed, or closed notice */
  displayMode: 'submit' | 'viewing' | 'closed';
}

/**
 * Poll module configuration
 * 
 * Real-time voting with multiple options. Links to a separate poll
 * document for storing votes and results.
 */
export interface PollModuleConfig {
  readonly moduleType: 'poll';
  /** Reference to poll document (when Poll module is implemented) */
  pollId?: string;
  question: string;
  options: string[];
  allowMultiple: boolean;
}

/**
 * Countdown module configuration
 * 
 * Displays a countdown timer, typically used before an event starts
 * or between segments.
 */
export interface CountdownModuleConfig {
  readonly moduleType: 'countdown';
  /** ISO 8601 string for the target time */
  targetTime: string;
  title?: string;
  /** Message to display when the countdown reaches zero */
  completedMessage?: string;
}

/**
 * Sponsor module configuration
 * 
 * Displays sponsor/partner content - images, messages, or links.
 */
export interface SponsorModuleConfig {
  readonly moduleType: 'sponsor';
  sponsorName: string;
  imageUrl?: string;
  message?: string;
  linkUrl?: string;
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
 *     case 'welcome':
 *       return <WelcomeScreen title={config.title} />; // TypeScript knows this is WelcomeModuleConfig
 *     case 'poll':
 *       return <PollWidget question={config.question} />; // TypeScript knows this is PollModuleConfig
 *   }
 * }
 * ```
 */
export type ModuleConfig =
  | WelcomeModuleConfig
  | QnaModuleConfig
  | PollModuleConfig
  | CountdownModuleConfig
  | SponsorModuleConfig;
