"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import {
  useMessages,
  useMessageColumns,
  moveMessage,
  reorderMessage,
  createMessageColumn,
  updateMessageColumn,
  auth,
  type ColumnMessageEntryDocument,
} from "@brayford/firebase-utils";
import {
  type EventDocument,
  type MessageDocument,
  type MessageColumnDocument,
  type MessageId,
  type MessageColumnId,
  MAX_COLUMNS_PER_EVENT,
  fromBranded,
  toBranded,
} from "@brayford/core";
import ModerationKanbanColumn from "./ModerationKanbanColumn";
import ModerationMessageCard from "./ModerationMessageCard";
import AddColumnModal from "./AddColumnModal";

interface MessageModerationViewProps {
  event: EventDocument;
}

type ActiveDragItem =
  | { type: "column"; column: MessageColumnDocument }
  | { type: "message"; message: MessageDocument; columnId: MessageColumnId };

/**
 * The message moderation board for a live event.
 *
 * Renders a horizontal Kanban board where moderators can:
 * - View all incoming audience messages (real-time, capped at MAX_INBOX_MESSAGES)
 * - Drag messages between columns to organise them
 * - Reorder messages within a column
 * - Reorder columns (the default inbox is fixed at the front)
 * - Create new columns (hard-capped at MAX_COLUMNS_PER_EVENT)
 * - Rename and delete columns (non-inbox, empty only)
 * - Delete messages — with confirmation, or instantly via Shift+click
 * - Edit the display text of a message (editedContent)
 *
 * Architecture:
 * - useMessages at board level → Map<MessageId, MessageDocument> for O(1) lookups
 * - useMessageColumns at board level → ordered columns array
 * - useColumnMessageEntries inside each ModerationKanbanColumn → per-column ordering
 * - columnEntriesRef collects entry snapshots from columns for DnD order maths
 */
export default function MessageModerationView({
  event,
}: MessageModerationViewProps) {
  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
  const [activeDragItem, setActiveDragItem] = useState<ActiveDragItem | null>(
    null,
  );

  const {
    messages,
    loading: messagesLoading,
    error: messagesError,
  } = useMessages(event.id, event.organizationId);

  const {
    columns,
    loading: columnsLoading,
    error: columnsError,
  } = useMessageColumns(event.id, event.organizationId);

  /**
   * Guard ref prevents the default inbox from being created more than once.
   * Set to true as soon as the creation request fires.
   */
  const inboxCreatedRef = useRef(false);

  /**
   * Client-side fallback: if the real-time column subscription yields zero
   * columns after loading completes, call the server-side ensure-inbox
   * endpoint to create the default inbox. This covers events created before
   * the server-side step was added, or if the inbox was accidentally deleted.
   *
   * The API route is idempotent — safe to call even if a race creates the
   * column between the snapshot arriving and the request landing.
   */
  useEffect(() => {
    if (columnsLoading || columns.length > 0 || inboxCreatedRef.current) return;

    inboxCreatedRef.current = true;

    void (async () => {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) return;

        await fetch("/api/message-columns/ensure-inbox", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            eventId: fromBranded(event.id),
            organizationId: fromBranded(event.organizationId),
            brandId: fromBranded(event.brandId),
          }),
        });
      } catch (err) {
        console.error("Failed to ensure default inbox column:", err);
      }
    })();
  }, [columnsLoading, columns.length, event.id, event.organizationId, event.brandId]);

  /**
   * Stores the latest entry snapshot from each column, keyed by raw column ID string.
   * Updated via the onEntriesChange callback passed to each ModerationKanbanColumn.
   * Used in handleDragEnd to compute insert orders without lifting subscription state.
   */
  const columnEntriesRef = useRef<Map<string, ColumnMessageEntryDocument[]>>(
    new Map(),
  );

  const handleEntriesChange = useCallback(
    (columnIdStr: string, entries: ColumnMessageEntryDocument[]) => {
      columnEntriesRef.current.set(columnIdStr, entries);
    },
    [],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Small activation distance prevents accidental drags when clicking action buttons
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // ===== DnD handlers =====

  const handleDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current;
    if (!data) return;

    if (data.type === "column") {
      const col = columns.find(
        (c) => fromBranded(c.id) === (data.columnId as string),
      );
      if (col) setActiveDragItem({ type: "column", column: col });
    } else if (data.type === "message") {
      const msg = messages.get(toBranded<MessageId>(data.messageId as string));
      if (msg) {
        setActiveDragItem({
          type: "message",
          message: msg,
          columnId: toBranded<MessageColumnId>(data.columnId as string),
        });
      }
    }
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveDragItem(null);
    if (!over || active.id === over.id) return;

    const activeType = active.data.current?.type as string | undefined;

    // ── Column reorder ──────────────────────────────────────────────────────
    if (activeType === "column") {
      const activeId = active.id as string; // "col:abc"
      const overId = over.id as string;

      // Guard: only accept column-to-column drops
      if (!overId.startsWith("col:")) return;

      const oldIdx = columns.findIndex(
        (c) => `col:${fromBranded(c.id)}` === activeId,
      );
      const newIdx = columns.findIndex(
        (c) => `col:${fromBranded(c.id)}` === overId,
      );

      if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return;

      const reordered = arrayMove(columns, oldIdx, newIdx);

      // Re-assign orders: default inbox always stays at 0; custom columns
      // receive 1000, 2000, … in their new positions.
      let counter = 1000;
      const updates: Promise<void>[] = [];

      for (const col of reordered) {
        const newOrder = col.isDefault ? 0 : counter;
        if (!col.isDefault) counter += 1000;
        if (col.order !== newOrder) {
          updates.push(updateMessageColumn(col.id, { order: newOrder }));
        }
      }

      await Promise.all(updates);
      return;
    }

    // ── Message move / reorder ──────────────────────────────────────────────
    if (activeType === "message") {
      const msgId = toBranded<MessageId>(
        active.data.current?.messageId as string,
      );
      const srcColId = toBranded<MessageColumnId>(
        active.data.current?.columnId as string,
      );

      // Determine target column from the 'over' element
      const overType = over.data.current?.type as string | undefined;
      let dstColId: MessageColumnId = srcColId;

      if (overType === "message") {
        dstColId = toBranded<MessageColumnId>(
          over.data.current?.columnId as string,
        );
      } else if (overType === "column-drop") {
        dstColId = toBranded<MessageColumnId>(
          over.data.current?.columnId as string,
        );
      }

      const srcColIdStr = fromBranded(srcColId);
      const dstColIdStr = fromBranded(dstColId);
      const srcEntries = columnEntriesRef.current.get(srcColIdStr) ?? [];
      const dstEntries = columnEntriesRef.current.get(dstColIdStr) ?? [];

      // ── Within-column reorder ───────────────────────────────────────────
      if (srcColIdStr === dstColIdStr) {
        const oldIdx = srcEntries.findIndex(
          (entry) => fromBranded(entry.id) === fromBranded(msgId),
        );
        const overMsgIdStr = over.data.current?.messageId as string | undefined;
        const newIdx = overMsgIdStr
          ? srcEntries.findIndex(
              (entry) => fromBranded(entry.id) === overMsgIdStr,
            )
          : srcEntries.length - 1;

        if (oldIdx < 0 || oldIdx === newIdx) return;

        // Compute midpoint order between new neighbours
        const reordered = arrayMove(srcEntries, oldIdx, newIdx);
        const prev = reordered[newIdx - 1];
        const next = reordered[newIdx + 1];
        let newOrder: number;
        if (!prev) {
          newOrder = Math.floor((next?.order ?? 2000) / 2);
        } else if (!next) {
          newOrder = prev.order + 1000;
        } else {
          newOrder = Math.floor((prev.order + next.order) / 2);
        }

        await reorderMessage(srcColId, msgId, newOrder);
        return;
      }

      // ── Cross-column move ──────────────────────────────────────────────
      const overMsgIdStr = over.data.current?.messageId as string | undefined;
      let newOrder: number;

      if (overMsgIdStr) {
        // Dropped on a specific message → insert before it
        const dstIdx = dstEntries.findIndex(
          (entry) => fromBranded(entry.id) === overMsgIdStr,
        );
        const prev = dstEntries[dstIdx - 1];
        const curr = dstEntries[dstIdx];
        if (!prev) {
          newOrder = Math.floor((curr?.order ?? 2000) / 2);
        } else {
          newOrder = Math.floor((prev.order + curr.order) / 2);
        }
      } else {
        // Dropped on the column empty zone → append to bottom
        const last = dstEntries[dstEntries.length - 1];
        newOrder = last ? last.order + 1000 : 1000;
      }

      await moveMessage(msgId, srcColId, dstColId, newOrder);
    }
  };

  // ===== Column creation =====

  const handleCreateColumn = async (name: string) => {
    const maxOrder = columns.reduce((mx, c) => Math.max(mx, c.order), 0);
    await createMessageColumn({
      eventId: fromBranded(event.id),
      organizationId: fromBranded(event.organizationId),
      brandId: fromBranded(event.brandId),
      name,
      order: maxOrder + 1000,
      isDefault: false,
      isBin: false,
    });
  };

  // ===== Render states =====

  if (columnsLoading || messagesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-gray-500 text-sm">Loading…</span>
      </div>
    );
  }

  if (columnsError || messagesError) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-red-400 text-sm">
          Failed to load message board. Please refresh.
        </span>
      </div>
    );
  }

  const isAtCap = columns.length >= MAX_COLUMNS_PER_EVENT;
  const columnSortableIds = columns.map((c) => `col:${fromBranded(c.id)}`);

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800 flex-shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-white">
                Message Moderation
              </h2>
            </div>

            <div className="flex items-center gap-3">
              {isAtCap && (
                <span className="text-xs text-amber-400">
                  Column limit reached ({MAX_COLUMNS_PER_EVENT})
                </span>
              )}
              <button
                onClick={() => setIsAddColumnOpen(true)}
                disabled={isAtCap}
                title={
                  isAtCap
                    ? `Maximum of ${MAX_COLUMNS_PER_EVENT} columns reached`
                    : "Add a new column"
                }
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add column
              </button>
            </div>
          </div>

          {/* Kanban board */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex items-start gap-4 p-6 h-full min-w-max">
              <SortableContext
                items={columnSortableIds}
                strategy={horizontalListSortingStrategy}
              >
                {columns.map((column) => (
                  <ModerationKanbanColumn
                    key={fromBranded(column.id)}
                    column={column}
                    messages={messages}
                    onEntriesChange={handleEntriesChange}
                  />
                ))}
              </SortableContext>
            </div>
          </div>
        </div>

        {/* Drag overlay — follows cursor while dragging */}
        <DragOverlay dropAnimation={null}>
          {activeDragItem?.type === "column" && (
            // Simplified column ghost — avoids a duplicate Firestore subscription
            <div className="w-72 flex-shrink-0 rounded-xl bg-gray-800 border border-indigo-500/60 shadow-2xl opacity-90 cursor-grabbing">
              <div className="px-4 py-3 border-b border-gray-700">
                <p className="text-sm font-semibold text-white truncate">
                  {activeDragItem.column.name}
                </p>
              </div>
            </div>
          )}
          {activeDragItem?.type === "message" && (
            <ModerationMessageCard
              message={activeDragItem.message}
              columnId={activeDragItem.columnId}
              isDragOverlay
            />
          )}
        </DragOverlay>
      </DndContext>

      <AddColumnModal
        isOpen={isAddColumnOpen}
        onClose={() => setIsAddColumnOpen(false)}
        onCreate={handleCreateColumn}
      />
    </>
  );
}
