/**
 * Message Column Schema - Interaction Domain
 *
 * Represents a column in the Kanban-style message moderation board for an event.
 * Moderators move messages between columns via drag-and-drop in the creator console.
 *
 * Each event with a messaging module has at least one column — the default inbox,
 * auto-created when the messaging module is first activated on an event. Additional
 * columns (e.g. "On Air", "Done") are created manually by the creator.
 *
 * The column document stores metadata only. Message membership and within-column
 * ordering is stored in a subcollection to keep writes small and targeted:
 *
 *   /messageColumns/{columnId}/messages/{messageId}
 *
 * Firestore Collection: /messageColumns/{columnId}
 * Subcollection:        /messageColumns/{columnId}/messages/{messageId}
 */

import { z } from 'zod';
import type { EventId, OrganizationId, BrandId, MessageColumnId } from '../types/branded';
import { MAX_COLUMN_NAME_LENGTH } from '../constants/messaging';

/**
 * Base message column object schema (without cross-field refinements).
 * Used internally to derive Create/Update schemas via .omit() / .pick().
 *
 * Prefer `MessageColumnSchema` for validation.
 */
const MessageColumnBaseSchema = z.object({
  eventId: z.string().describe('Parent event'),
  organizationId: z.string().describe('Denormalised for security rules'),
  brandId: z.string().describe('Denormalised for security rules'),
  name: z
    .string()
    .min(1)
    .max(MAX_COLUMN_NAME_LENGTH, `Column name must not exceed ${MAX_COLUMN_NAME_LENGTH} characters`)
    .describe('Display name shown in the moderation console'),
  order: z
    .number()
    .int()
    .min(0)
    .describe('Column position in the board (higher = further right)'),
  isDefault: z
    .boolean()
    .describe('True for the inbox column. New messages land here automatically. Only one column per event may be the default.'),
  isBin: z
    .boolean()
    .describe('True for the bin/reject column. Messages dragged here are treated as discarded.'),
  messageCount: z
    .number()
    .int()
    .min(0)
    .describe('Denormalised message count, kept in sync by atomic API writes'),
  createdAt: z.date().describe('Column creation timestamp'),
  updatedAt: z.date().describe('Last modification timestamp'),
});

/**
 * Message column document schema with cross-field validation.
 *
 * @property eventId - Parent event
 * @property organizationId - Denormalised for security rules
 * @property brandId - Denormalised for security rules
 * @property name - Display name shown in the moderation console
 * @property order - Column position in the board (0-indexed, spaced by 1000)
 * @property isDefault - True for the inbox; new messages land here automatically
 * @property isBin - True for the bin/reject column; messages here are treated as discarded
 * @property messageCount - Denormalised count, kept in sync by atomic API writes
 * @property createdAt - Column creation timestamp
 * @property updatedAt - Last modification timestamp
 */
export const MessageColumnSchema = MessageColumnBaseSchema.refine(
  (data) => !(data.isDefault && data.isBin),
  {
    message: 'A column cannot be both the default inbox and the bin',
    path: ['isBin'],
  },
);

export type MessageColumn = z.infer<typeof MessageColumnSchema>;

/**
 * Message column document as returned from Firestore, with typed branded ID fields.
 */
export interface MessageColumnDocument extends MessageColumn {
  id: MessageColumnId;
  eventId: EventId;
  organizationId: OrganizationId;
  brandId: BrandId;
}

// ===== Column Message Entry (subcollection document) =====

/**
 * Represents a message's membership in a specific column.
 *
 * This is a join-table document in the subcollection — it never contains message
 * content, only ordering data. The message document itself lives in /messages/.
 *
 * Subcollection: /messageColumns/{columnId}/messages/{messageId}
 *
 * @property messageId - Reference to the message document in /messages/
 * @property addedAt - When the message was added to this column
 * @property order - Sort order within the column (spaced by 1000 to allow easy insertion)
 */
export const ColumnMessageEntrySchema = z.object({
  messageId: z.string().describe('Reference to the message document in /messages/'),
  addedAt: z.date().describe('When the message was added to this column'),
  order: z
    .number()
    .int()
    .describe('Sort order within the column. Spaced by 1000 to allow easy insertion without rewriting all entries.'),
});

export type ColumnMessageEntry = z.infer<typeof ColumnMessageEntrySchema>;

// ===== Create / Update =====

/**
 * Data required to create a new column.
 * Server-side fields (messageCount, timestamps) are excluded.
 */
export const CreateMessageColumnSchema = MessageColumnBaseSchema.omit({
  messageCount: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateMessageColumnData = z.infer<typeof CreateMessageColumnSchema>;

/**
 * Data allowed when updating a column.
 * Identity fields and isDefault cannot be changed after creation.
 */
export const UpdateMessageColumnSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(MAX_COLUMN_NAME_LENGTH)
    .optional(),
  order: z.number().int().min(0).optional(),
  isBin: z.boolean().optional(),
  messageCount: z.number().int().min(0).optional(),
  updatedAt: z.date(),
});
export type UpdateMessageColumnData = z.infer<typeof UpdateMessageColumnSchema>;

// ===== Validation Helpers =====

export function validateMessageColumnData(data: unknown): MessageColumn {
  return MessageColumnSchema.parse(data);
}

export function validateCreateMessageColumnData(data: unknown): CreateMessageColumnData {
  return CreateMessageColumnSchema.parse(data);
}

export function validateUpdateMessageColumnData(data: unknown): UpdateMessageColumnData {
  return UpdateMessageColumnSchema.parse(data);
}

export function validateColumnMessageEntryData(data: unknown): ColumnMessageEntry {
  return ColumnMessageEntrySchema.parse(data);
}
