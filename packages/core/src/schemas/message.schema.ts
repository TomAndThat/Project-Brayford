/**
 * Message Schema - Interaction Domain
 *
 * Represents an audience-submitted message associated with an event.
 * Message content is written once on submission and treated as immutable.
 *
 * Moderators may set `editedContent` to adjust the message before using it
 * (e.g. fixing a typo). The display layer should always render
 * `editedContent ?? content` so the original is preserved for audit purposes.
 *
 * Firestore Collection: /messages/{messageId}
 *
 * Messages are associated with event-level moderation columns via the
 * subcollection: /messageColumns/{columnId}/messages/{messageId}
 *
 * @see message-column.schema.ts for the moderation board structure
 */

import { z } from 'zod';
import type { EventId, OrganizationId, BrandId, MessageId } from '../types/branded';
import {
  MIN_MESSAGE_CONTENT_LENGTH,
  MAX_MESSAGE_CONTENT_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
} from '../constants/messaging';

/**
 * Message document schema
 *
 * @property eventId - Parent event
 * @property organizationId - Denormalised for security rules and efficient queries
 * @property brandId - Denormalised for security rules
 * @property content - Original message text, immutable after submission
 * @property editedContent - Moderator-edited version, null if unedited
 * @property displayName - Optional name provided by the audience member, null if omitted
 * @property audienceUUID - Device identifier used for rate limiting
 * @property isDeleted - Soft delete flag; deleted messages are excluded from all queries
 * @property submittedAt - When the message was submitted
 * @property updatedAt - When the message was last modified (edit, soft-delete, etc.)
 */
export const MessageSchema = z.object({
  eventId: z.string().describe('Parent event'),
  organizationId: z.string().describe('Denormalised for security rules and efficient queries'),
  brandId: z.string().describe('Denormalised for security rules'),
  content: z
    .string()
    .min(MIN_MESSAGE_CONTENT_LENGTH, `Message must be at least ${MIN_MESSAGE_CONTENT_LENGTH} characters`)
    .max(MAX_MESSAGE_CONTENT_LENGTH, `Message must not exceed ${MAX_MESSAGE_CONTENT_LENGTH} characters`)
    .describe('Original message as submitted by the audience member'),
  editedContent: z
    .string()
    .max(MAX_MESSAGE_CONTENT_LENGTH, `Edited message must not exceed ${MAX_MESSAGE_CONTENT_LENGTH} characters`)
    .nullable()
    .describe('Moderator-edited version of the message. Display layer renders editedContent ?? content'),
  displayName: z
    .string()
    .max(MAX_DISPLAY_NAME_LENGTH, `Display name must not exceed ${MAX_DISPLAY_NAME_LENGTH} characters`)
    .nullable()
    .describe('Optional name provided by the audience member'),
  audienceUUID: z
    .string()
    .uuid()
    .describe('Device identifier used for rate limiting'),
  isDeleted: z
    .boolean()
    .default(false)
    .describe('Soft delete flag. Deleted messages are excluded from all queries'),
  submittedAt: z.date().describe('When the message was submitted'),
  updatedAt: z.date().describe('When the message was last modified'),
});

export type Message = z.infer<typeof MessageSchema>;

/**
 * Message document as returned from Firestore, with typed branded ID fields.
 */
export interface MessageDocument extends Message {
  id: MessageId;
  eventId: EventId;
  organizationId: OrganizationId;
  brandId: BrandId;
}

// ===== Create / Update =====

/**
 * Data required to create a new message.
 * Server-side fields (editedContent, isDeleted, timestamps) are excluded.
 */
export const CreateMessageSchema = MessageSchema.omit({
  editedContent: true,
  isDeleted: true,
  submittedAt: true,
  updatedAt: true,
});
export type CreateMessageData = z.infer<typeof CreateMessageSchema>;

/**
 * Data allowed when updating a message.
 * Only moderator-controlled fields; core identity and content fields are immutable.
 */
export const UpdateMessageSchema = z.object({
  editedContent: z
    .string()
    .max(MAX_MESSAGE_CONTENT_LENGTH)
    .nullable()
    .optional(),
  isDeleted: z.boolean().optional(),
  updatedAt: z.date(),
});
export type UpdateMessageData = z.infer<typeof UpdateMessageSchema>;

// ===== Validation Helpers =====

export function validateMessageData(data: unknown): Message {
  return MessageSchema.parse(data);
}

export function validateCreateMessageData(data: unknown): CreateMessageData {
  return CreateMessageSchema.parse(data);
}

export function validateUpdateMessageData(data: unknown): UpdateMessageData {
  return UpdateMessageSchema.parse(data);
}
