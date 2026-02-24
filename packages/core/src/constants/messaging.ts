/**
 * Messaging Module Constants - Interaction Domain
 *
 * Configurable limits and defaults for the messaging module.
 * Change these values here to update behaviour across all apps.
 */

/**
 * Minimum number of characters required in a message submission.
 */
export const MIN_MESSAGE_CONTENT_LENGTH = 5;

/**
 * Maximum number of characters allowed in a message submission.
 */
export const MAX_MESSAGE_CONTENT_LENGTH = 500;

/**
 * Maximum number of characters allowed in an audience member's display name.
 */
export const MAX_DISPLAY_NAME_LENGTH = 50;

/**
 * Maximum number of characters allowed in a column name.
 */
export const MAX_COLUMN_NAME_LENGTH = 50;

/**
 * Rate limit: minimum seconds between submissions from the same device.
 * Enforced server-side via Firestore transaction on the audience session.
 */
export const MESSAGE_RATE_LIMIT_SECONDS = 30;

/**
 * Maximum messages shown in the default (inbox) column before pagination kicks in.
 * Prevents unbounded onSnapshot costs at high submission volume.
 */
export const MAX_INBOX_MESSAGES = 250;

/**
 * Default name for the inbox column, auto-created when the messaging module is activated.
 */
export const DEFAULT_INBOX_COLUMN_NAME = 'Inbox';

/**
 * Maximum total number of message columns per event (including the default inbox).
 * Enforced in the creator app's moderation board to prevent unbounded Firestore
 * subscription costs (one onSnapshot listener per visible column).
 */
export const MAX_COLUMNS_PER_EVENT = 8;
