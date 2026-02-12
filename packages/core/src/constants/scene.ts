/**
 * Scene System Constants - Interaction Domain
 * 
 * Configurable limits and defaults for the scene system.
 * Change these values here to update behaviour across all apps.
 */

/**
 * Maximum number of modules allowed in a single scene.
 * Prevents overly complex scenes that would degrade audience UX.
 */
export const MAX_MODULES_PER_SCENE = 20;

/**
 * Maximum number of scenes allowed per event.
 * Soft limit enforced in validation and UI.
 */
export const MAX_SCENES_PER_EVENT = 50;

/**
 * Maximum number of scene switch history entries stored on the event document.
 * Oldest entries are dropped when this limit is exceeded.
 * 
 * 500 entries × ~100 bytes = ~50KB, well within Firestore's 1MB doc limit.
 */
export const MAX_SCENE_HISTORY_ENTRIES = 500;

/**
 * Default spacing interval for module order values.
 * Using gaps (e.g., 0, 10, 20) allows inserting between items without renumbering.
 */
export const MODULE_ORDER_INTERVAL = 10;
