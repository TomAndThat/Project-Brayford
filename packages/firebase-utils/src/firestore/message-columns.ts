/**
 * Message Column Firestore Operations
 * Interaction Domain
 *
 * CRUD operations and real-time hooks for message columns and their message
 * subcollections. Columns form the Kanban moderation board used by creators
 * to review, organise, and display audience messages.
 *
 * Each event with a messaging module has at least one column — the default
 * inbox — auto-created when the module is first activated.
 *
 * Firestore Collection: /messageColumns/{columnId}
 * Subcollection:        /messageColumns/{columnId}/messages/{messageId}
 *
 * @see message-column.schema.ts for data model details
 */

import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  increment,
  Timestamp,
  type DocumentReference,
  type CollectionReference,
} from 'firebase/firestore';
import { db } from '../config';
import { withJitter } from '../jitter';
import {
  validateMessageColumnData,
  validateColumnMessageEntryData,
  type MessageColumn,
  type MessageColumnDocument,
  type ColumnMessageEntry,
  type CreateMessageColumnData,
  type UpdateMessageColumnData,
  toBranded,
  fromBranded,
  type MessageColumnId,
  type MessageId,
  type EventId,
  type OrganizationId,
  type BrandId,
} from '@brayford/core';

// ===== Extended Types =====

/**
 * A column message entry as returned by Firestore, with typed ID fields.
 * The document ID in the subcollection is always the `messageId`.
 */
export interface ColumnMessageEntryDocument extends ColumnMessageEntry {
  /** The message ID — mirrors the document ID in the subcollection */
  id: MessageId;
  /** The parent column ID */
  columnId: MessageColumnId;
}

// ===== Collection Helpers =====

/**
 * Get a typed reference to the messageColumns collection
 */
function getMessageColumnsCollection(): CollectionReference<MessageColumn> {
  return collection(db, 'messageColumns') as CollectionReference<MessageColumn>;
}

/**
 * Get a reference to a specific message column document
 */
export function getMessageColumnRef(
  columnId: MessageColumnId,
): DocumentReference<MessageColumn> {
  return doc(db, 'messageColumns', fromBranded(columnId)) as DocumentReference<MessageColumn>;
}

/**
 * Get a reference to the messages subcollection within a column
 */
function getColumnMessagesCollection(
  columnId: MessageColumnId,
): CollectionReference {
  return collection(db, 'messageColumns', fromBranded(columnId), 'messages');
}

// ===== Timestamp Conversion =====

/**
 * Convert raw Firestore data to a typed MessageColumnDocument.
 */
function toMessageColumnDocument(
  id: string,
  rawData: Record<string, unknown>,
): MessageColumnDocument {
  const data = validateMessageColumnData({
    ...rawData,
    createdAt: rawData.createdAt instanceof Timestamp
      ? rawData.createdAt.toDate()
      : rawData.createdAt,
    updatedAt: rawData.updatedAt instanceof Timestamp
      ? rawData.updatedAt.toDate()
      : rawData.updatedAt,
  });

  return {
    ...data,
    id: toBranded<MessageColumnId>(id),
    eventId: toBranded<EventId>(data.eventId),
    organizationId: toBranded<OrganizationId>(data.organizationId),
    brandId: toBranded<BrandId>(data.brandId),
  };
}

/**
 * Convert raw Firestore subcollection data to a typed ColumnMessageEntryDocument.
 */
function toColumnMessageEntryDocument(
  id: string,
  columnId: MessageColumnId,
  rawData: Record<string, unknown>,
): ColumnMessageEntryDocument {
  const data = validateColumnMessageEntryData({
    ...rawData,
    addedAt: rawData.addedAt instanceof Timestamp
      ? rawData.addedAt.toDate()
      : rawData.addedAt,
  });

  return {
    ...data,
    id: toBranded<MessageId>(id),
    columnId,
    messageId: toBranded<MessageId>(data.messageId),
  };
}

// ===== Column Read Operations =====

/**
 * Get a single message column by ID
 *
 * @param columnId - Column ID (branded type)
 * @returns Message column document or null if not found
 *
 * @example
 * ```ts
 * const column = await getMessageColumn(columnId);
 * ```
 */
export async function getMessageColumn(
  columnId: MessageColumnId,
): Promise<MessageColumnDocument | null> {
  const colRef = getMessageColumnRef(columnId);
  const colSnap = await getDoc(colRef);

  if (!colSnap.exists()) {
    return null;
  }

  return toMessageColumnDocument(colSnap.id, colSnap.data() as Record<string, unknown>);
}

/**
 * Get all columns for an event, ordered by their board position
 *
 * @param eventId - Event ID
 * @returns Array of message column documents, ordered by `order` ascending
 *
 * @example
 * ```ts
 * const columns = await getEventMessageColumns(eventId);
 * ```
 */
export async function getEventMessageColumns(
  eventId: EventId,
): Promise<MessageColumnDocument[]> {
  const q = query(
    getMessageColumnsCollection(),
    where('eventId', '==', fromBranded(eventId)),
    orderBy('order', 'asc'),
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) =>
    toMessageColumnDocument(d.id, d.data() as Record<string, unknown>)
  );
}

// ===== Column Write Operations =====

/**
 * Create a new message column for an event
 *
 * Timestamps and `messageCount` are assigned server-side.
 *
 * @param data - Column creation data (see `CreateMessageColumnData`)
 * @returns ID of the newly created column
 *
 * @example
 * ```ts
 * const columnId = await createMessageColumn({
 *   eventId: fromBranded(eventId),
 *   organizationId: fromBranded(orgId),
 *   brandId: fromBranded(brandId),
 *   name: 'On Air',
 *   order: 1000,
 *   isDefault: false,
 *   isBin: false,
 * });
 * ```
 */
export async function createMessageColumn(
  data: CreateMessageColumnData,
): Promise<MessageColumnId> {
  const colRef = doc(getMessageColumnsCollection());
  const columnId = toBranded<MessageColumnId>(colRef.id);

  await setDoc(colRef, {
    ...data,
    messageCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return columnId;
}

/**
 * Update a message column
 *
 * Identity fields (`eventId`, `organizationId`, `brandId`) and `isDefault`
 * cannot be changed after creation — the schema enforces this.
 *
 * @param columnId - Column ID to update
 * @param data - Partial update data
 *
 * @example
 * ```ts
 * await updateMessageColumn(columnId, { name: 'Screened' });
 * await updateMessageColumn(columnId, { order: 2000, isBin: true });
 * ```
 */
export async function updateMessageColumn(
  columnId: MessageColumnId,
  data: Omit<UpdateMessageColumnData, 'updatedAt'>,
): Promise<void> {
  const colRef = doc(db, 'messageColumns', fromBranded(columnId));
  await updateDoc(colRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a message column
 *
 * Rejects if the column is the default inbox — the default column is
 * protected and can only be removed by deleting the messaging module itself.
 *
 * Note: subcollection entries in `/messageColumns/{columnId}/messages` must be
 * deleted separately (typically via a Cloud Function or batch before this call).
 *
 * @param columnId - Column ID to delete
 * @throws {Error} If the column is the default inbox
 *
 * @example
 * ```ts
 * await deleteMessageColumn(columnId);
 * ```
 */
export async function deleteMessageColumn(
  columnId: MessageColumnId,
): Promise<void> {
  const colRef = getMessageColumnRef(columnId);
  const colSnap = await getDoc(colRef);

  if (!colSnap.exists()) {
    return;
  }

  const data = colSnap.data() as MessageColumn;
  if (data.isDefault) {
    throw new Error(
      'Cannot delete the default inbox column. Remove the messaging module from the scene to delete it.',
    );
  }

  await deleteDoc(doc(db, 'messageColumns', fromBranded(columnId)));
}

// ===== Subcollection Operations =====

/**
 * Add a message to a column's entry subcollection
 *
 * Writes a `ColumnMessageEntry` document keyed by `messageId` and increments
 * the column's denormalised `messageCount`.
 *
 * If `order` is not provided, `Date.now()` is used as a sensible default
 * that places the entry after any existing entries with lower timestamps.
 *
 * @param messageId - Message to add
 * @param columnId - Target column
 * @param order - Sort position within the column (optional, defaults to Date.now())
 *
 * @example
 * ```ts
 * await addMessageToColumn(messageId, inboxColumnId);
 * await addMessageToColumn(messageId, onAirColumnId, 3500);
 * ```
 */
export async function addMessageToColumn(
  messageId: MessageId,
  columnId: MessageColumnId,
  order: number = Date.now(),
): Promise<void> {
  const batch = writeBatch(db);

  const entryRef = doc(
    db,
    'messageColumns',
    fromBranded(columnId),
    'messages',
    fromBranded(messageId),
  );
  const columnRef = doc(db, 'messageColumns', fromBranded(columnId));

  batch.set(entryRef, {
    messageId: fromBranded(messageId),
    addedAt: serverTimestamp(),
    order,
  });

  batch.update(columnRef, {
    messageCount: increment(1),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}

/**
 * Remove a message from a column's entry subcollection
 *
 * Deletes the subcollection entry and decrements the column's denormalised
 * `messageCount`. The message document itself in `/messages/` is unaffected.
 *
 * @param messageId - Message to remove
 * @param columnId - Source column
 *
 * @example
 * ```ts
 * await removeMessageFromColumn(messageId, columnId);
 * ```
 */
export async function removeMessageFromColumn(
  messageId: MessageId,
  columnId: MessageColumnId,
): Promise<void> {
  const batch = writeBatch(db);

  const entryRef = doc(
    db,
    'messageColumns',
    fromBranded(columnId),
    'messages',
    fromBranded(messageId),
  );
  const columnRef = doc(db, 'messageColumns', fromBranded(columnId));

  batch.delete(entryRef);

  batch.update(columnRef, {
    messageCount: increment(-1),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}

/**
 * Move a message from one column to another atomically
 *
 * Performs a batched write that:
 *   1. Deletes the entry from the source column's subcollection
 *   2. Creates the entry in the target column's subcollection
 *   3. Decrements `messageCount` on the source column
 *   4. Increments `messageCount` on the target column
 *
 * Wrapped in `withJitter` to protect against bursts when multiple moderators
 * are active simultaneously (e.g., during high-volume events).
 *
 * @param messageId - Message to move
 * @param fromColumnId - Source column
 * @param toColumnId - Target column
 * @param newOrder - Sort position in the target column (defaults to Date.now())
 *
 * @example
 * ```ts
 * // Move a message from the inbox to the "On Air" column
 * await moveMessage(messageId, inboxColumnId, onAirColumnId, 1500);
 * ```
 */
export async function moveMessage(
  messageId: MessageId,
  fromColumnId: MessageColumnId,
  toColumnId: MessageColumnId,
  newOrder: number = Date.now(),
): Promise<void> {
  await withJitter(
    async () => {
      const batch = writeBatch(db);

      const sourceEntryRef = doc(
        db,
        'messageColumns',
        fromBranded(fromColumnId),
        'messages',
        fromBranded(messageId),
      );
      const targetEntryRef = doc(
        db,
        'messageColumns',
        fromBranded(toColumnId),
        'messages',
        fromBranded(messageId),
      );
      const sourceColumnRef = doc(db, 'messageColumns', fromBranded(fromColumnId));
      const targetColumnRef = doc(db, 'messageColumns', fromBranded(toColumnId));

      batch.delete(sourceEntryRef);

      batch.set(targetEntryRef, {
        messageId: fromBranded(messageId),
        addedAt: serverTimestamp(),
        order: newOrder,
      });

      batch.update(sourceColumnRef, {
        messageCount: increment(-1),
        updatedAt: serverTimestamp(),
      });

      batch.update(targetColumnRef, {
        messageCount: increment(1),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
    },
    { windowMs: 500 },
  );
}

/**
 * Update the sort order of a message within its current column
 *
 * Only updates the `order` field on the subcollection entry.
 * Use `moveMessage` when the target column is different.
 *
 * @param columnId - Column containing the message
 * @param messageId - Message entry to reorder
 * @param newOrder - New sort position
 *
 * @example
 * ```ts
 * await reorderMessage(columnId, messageId, 2500);
 * ```
 */
export async function reorderMessage(
  columnId: MessageColumnId,
  messageId: MessageId,
  newOrder: number,
): Promise<void> {
  const entryRef = doc(
    db,
    'messageColumns',
    fromBranded(columnId),
    'messages',
    fromBranded(messageId),
  );
  await updateDoc(entryRef, { order: newOrder });
}

// ===== Real-Time Hooks =====

/**
 * React hook for real-time message column updates for an event
 *
 * Subscribes to `/messageColumns` filtered by `eventId`, ordered by `order`
 * ascending (left-to-right board layout). Automatically unsubscribes on unmount.
 *
 * Used by:
 * - Creator app: Kanban board column headers and scene builder config
 *
 * @param eventId - Event ID to subscribe to
 * @param organizationId - Organization ID — required so the query satisfies
 *   Firestore security rules which gate reads on `resource.data.organizationId`
 * @returns Object with columns array, loading state, and error
 *
 * @example
 * ```tsx
 * function KanbanBoard({ eventId, orgId }: Props) {
 *   const { columns, loading, error } = useMessageColumns(eventId, orgId);
 *
 *   if (loading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <div className="flex gap-4">
 *       {columns.map((col) => (
 *         <KanbanColumn key={col.id} column={col} messages={messages} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useMessageColumns(eventId: EventId, organizationId: OrganizationId): {
  columns: MessageColumnDocument[];
  loading: boolean;
  error: Error | null;
} {
  const [columns, setColumns] = useState<MessageColumnDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const q = query(
      getMessageColumnsCollection(),
      where('eventId', '==', fromBranded(eventId)),
      where('organizationId', '==', fromBranded(organizationId)),
      orderBy('order', 'asc'),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const cols = snapshot.docs.map((d) =>
            toMessageColumnDocument(
              d.id,
              d.data({ serverTimestamps: 'estimate' }) as Record<string, unknown>,
            )
          );
          setColumns(cols);
        } catch (err) {
          setError(
            err instanceof Error
              ? err
              : new Error('Failed to parse message column data'),
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

  return { columns, loading, error };
}

/**
 * React hook for real-time column message entry updates
 *
 * Subscribes to `/messageColumns/{columnId}/messages`, ordered by `order`
 * ascending (top-to-bottom card layout within a column). Automatically
 * unsubscribes on unmount.
 *
 * Returns `ColumnMessageEntryDocument[]` — entry metadata only, not the
 * message content. Pair with `useMessages` at the board level and resolve
 * content using the returned `Map<MessageId, MessageDocument>`.
 *
 * Each column component should call this hook independently, keeping
 * subscriptions small and targeted (one per visible column, typically 3–5).
 *
 * Used by:
 * - Creator app: Individual Kanban column card lists
 *
 * @param columnId - Column ID to subscribe to
 * @returns Object with entries array, loading state, and error
 *
 * @example
 * ```tsx
 * function KanbanColumn({
 *   column,
 *   messages,
 * }: {
 *   column: MessageColumnDocument;
 *   messages: Map<MessageId, MessageDocument>;
 * }) {
 *   const { entries, loading } = useColumnMessageEntries(column.id);
 *
 *   return (
 *     <div>
 *       <h2>{column.name}</h2>
 *       {entries.map((entry) => {
 *         const message = messages.get(entry.id);
 *         if (!message) return null;
 *         return <MessageCard key={entry.id} message={message} />;
 *       })}
 *     </div>
 *   );
 * }
 * ```
 */
export function useColumnMessageEntries(columnId: MessageColumnId): {
  entries: ColumnMessageEntryDocument[];
  loading: boolean;
  error: Error | null;
} {
  const [entries, setEntries] = useState<ColumnMessageEntryDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const q = query(
      getColumnMessagesCollection(columnId),
      orderBy('order', 'asc'),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const entryDocs = snapshot.docs.map((d) =>
            toColumnMessageEntryDocument(
              d.id,
              columnId,
              d.data({ serverTimestamps: 'estimate' }) as Record<string, unknown>,
            )
          );
          setEntries(entryDocs);
        } catch (err) {
          setError(
            err instanceof Error
              ? err
              : new Error('Failed to parse column message entry data'),
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
  }, [columnId]);

  return { entries, loading, error };
}
