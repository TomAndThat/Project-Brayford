/**
 * Message Firestore Operations
 * Interaction Domain
 *
 * CRUD operations and real-time hooks for the messages collection.
 * Messages are audience-submitted and treated as immutable after creation.
 * Moderators may set `editedContent`; the display layer renders
 * `editedContent ?? content` so the original is preserved for audit purposes.
 *
 * Firestore Collection: /messages/{messageId}
 *
 * @see message-column.schema.ts for the moderation board structure
 */

import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type DocumentReference,
  type CollectionReference,
} from 'firebase/firestore';
import { db } from '../config';
import {
  validateMessageData,
  type Message,
  type MessageDocument,
  toBranded,
  fromBranded,
  type MessageId,
  type EventId,
  type OrganizationId,
  type BrandId,
  MAX_INBOX_MESSAGES,
} from '@brayford/core';

// ===== Collection Helpers =====

/**
 * Get a typed reference to the messages collection
 */
function getMessagesCollection(): CollectionReference<Message> {
  return collection(db, 'messages') as CollectionReference<Message>;
}

/**
 * Get a reference to a specific message document
 */
export function getMessageRef(messageId: MessageId): DocumentReference<Message> {
  return doc(db, 'messages', fromBranded(messageId)) as DocumentReference<Message>;
}

// ===== Timestamp Conversion =====

/**
 * Convert raw Firestore data to a typed MessageDocument.
 * Handles Timestamp → Date conversion and branded ID assignment.
 */
function toMessageDocument(id: string, rawData: Record<string, unknown>): MessageDocument {
  const data = validateMessageData({
    ...rawData,
    submittedAt: rawData.submittedAt instanceof Timestamp
      ? rawData.submittedAt.toDate()
      : rawData.submittedAt,
    updatedAt: rawData.updatedAt instanceof Timestamp
      ? rawData.updatedAt.toDate()
      : rawData.updatedAt,
  });

  return {
    ...data,
    id: toBranded<MessageId>(id),
    eventId: toBranded<EventId>(data.eventId),
    organizationId: toBranded<OrganizationId>(data.organizationId),
    brandId: toBranded<BrandId>(data.brandId),
  };
}

// ===== Read Operations =====

/**
 * Get a single message by ID
 *
 * @param messageId - Message ID (branded type)
 * @returns Message document or null if not found
 *
 * @example
 * ```ts
 * const message = await getMessage(messageId);
 * const display = message ? (message.editedContent ?? message.content) : null;
 * ```
 */
export async function getMessage(messageId: MessageId): Promise<MessageDocument | null> {
  const msgRef = getMessageRef(messageId);
  const msgSnap = await getDoc(msgRef);

  if (!msgSnap.exists()) {
    return null;
  }

  return toMessageDocument(msgSnap.id, msgSnap.data() as Record<string, unknown>);
}

/**
 * Get all non-deleted messages for an event (one-time fetch, for exports / analytics)
 *
 * Results are ordered by `submittedAt` ascending and are not paginated;
 * intended for server-side use only, not for real-time rendering.
 *
 * @param eventId - Event ID
 * @returns Array of message documents
 *
 * @example
 * ```ts
 * const messages = await getEventMessages(eventId);
 * // Export to CSV, feed analytics, etc.
 * ```
 */
export async function getEventMessages(eventId: EventId): Promise<MessageDocument[]> {
  const q = query(
    getMessagesCollection(),
    where('eventId', '==', fromBranded(eventId)),
    where('isDeleted', '==', false),
    orderBy('submittedAt', 'asc'),
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) =>
    toMessageDocument(d.id, d.data() as Record<string, unknown>)
  );
}

// ===== Write Operations =====

/**
 * Soft-delete a message
 *
 * Sets `isDeleted: true`. The message document is retained for audit purposes.
 * Deleted messages are automatically excluded from all queries.
 *
 * @param messageId - Message ID to soft-delete
 *
 * @example
 * ```ts
 * await softDeleteMessage(messageId);
 * ```
 */
export async function softDeleteMessage(messageId: MessageId): Promise<void> {
  const msgRef = doc(db, 'messages', fromBranded(messageId));
  await updateDoc(msgRef, {
    isDeleted: true,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Restore a soft-deleted message
 *
 * Reverses a soft-delete by setting `isDeleted: false`.
 *
 * @param messageId - Message ID to restore
 *
 * @example
 * ```ts
 * await restoreMessage(messageId);
 * ```
 */
export async function restoreMessage(messageId: MessageId): Promise<void> {
  const msgRef = doc(db, 'messages', fromBranded(messageId));
  await updateDoc(msgRef, {
    isDeleted: false,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Apply a moderator edit to a message
 *
 * Sets `editedContent`. The original `content` field is never modified.
 * Display layers should render `editedContent ?? content`.
 *
 * @param messageId - Message ID to edit
 * @param editedContent - Replacement text to display (must satisfy MAX_MESSAGE_CONTENT_LENGTH)
 *
 * @example
 * ```ts
 * await editMessage(messageId, 'Fixed typo in message');
 * ```
 */
export async function editMessage(
  messageId: MessageId,
  editedContent: string,
): Promise<void> {
  const msgRef = doc(db, 'messages', fromBranded(messageId));
  await updateDoc(msgRef, {
    editedContent,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Clear a moderator edit, reverting to the original message content
 *
 * Sets `editedContent` back to `null`. Display layers will then fall back
 * to the original `content`.
 *
 * @param messageId - Message ID to revert
 *
 * @example
 * ```ts
 * await clearMessageEdit(messageId);
 * ```
 */
export async function clearMessageEdit(messageId: MessageId): Promise<void> {
  const msgRef = doc(db, 'messages', fromBranded(messageId));
  await updateDoc(msgRef, {
    editedContent: null,
    updatedAt: serverTimestamp(),
  });
}

// ===== Real-Time Hook =====

/**
 * React hook for real-time message updates for an event
 *
 * Subscribes to all non-deleted messages for the given event using
 * `onSnapshot`, capped at `MAX_INBOX_MESSAGES` (250) ordered by submission
 * time descending to keep the most recent messages in view.
 *
 * Returns a `Map<MessageId, MessageDocument>` rather than an array so that
 * the moderation board can resolve column entries to message content in O(1).
 * Column ordering is provided by `useColumnMessageEntries`.
 *
 * Used by:
 * - Creator app: moderation board (resolves column entry IDs to message content)
 *
 * @param eventId - Event ID to subscribe to
 * @param organizationId - Organization ID — required so the query satisfies
 *   Firestore security rules which gate reads on `resource.data.organizationId`
 * @returns Object with messages Map, loading state, and error
 *
 * @example
 * ```tsx
 * function ModerationBoard({ eventId, orgId }: Props) {
 *   const { messages, loading, error } = useMessages(eventId, orgId);
 *
 *   if (loading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   // Pass messages map down to column components for O(1) lookups
 *   return <KanbanBoard messages={messages} />;
 * }
 * ```
 */
export function useMessages(eventId: EventId, organizationId: OrganizationId): {
  messages: Map<MessageId, MessageDocument>;
  loading: boolean;
  error: Error | null;
} {
  const [messages, setMessages] = useState<Map<MessageId, MessageDocument>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const q = query(
      getMessagesCollection(),
      where('eventId', '==', fromBranded(eventId)),
      where('organizationId', '==', fromBranded(organizationId)),
      where('isDeleted', '==', false),
      orderBy('submittedAt', 'desc'),
      limit(MAX_INBOX_MESSAGES),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const map = new Map<MessageId, MessageDocument>();
          for (const d of snapshot.docs) {
            const doc = toMessageDocument(d.id, d.data() as Record<string, unknown>);
            map.set(doc.id, doc);
          }
          setMessages(map);
        } catch (err) {
          setError(
            err instanceof Error
              ? err
              : new Error('Failed to parse message data'),
          );
        }
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    // Cleanup: unsubscribe from onSnapshot listener when component unmounts
    return unsubscribe;
  }, [eventId, organizationId]);

  return { messages, loading, error };
}
