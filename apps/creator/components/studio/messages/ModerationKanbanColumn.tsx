"use client";

import { useState, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  useColumnMessageEntries,
  updateMessageColumn,
  deleteMessageColumn,
  type ColumnMessageEntryDocument,
} from "@brayford/firebase-utils";
import {
  type MessageColumnDocument,
  type MessageDocument,
  type MessageId,
  MAX_COLUMN_NAME_LENGTH,
  fromBranded,
} from "@brayford/core";
import ModerationMessageCard from "./ModerationMessageCard";

interface ModerationKanbanColumnProps {
  column: MessageColumnDocument;
  messages: Map<MessageId, MessageDocument>;
  /**
   * Callback invoked whenever this column's ordered entries change.
   * The parent board uses these for DnD order calculations without
   * lifting the subscription state.
   */
  onEntriesChange: (
    columnId: string,
    entries: ColumnMessageEntryDocument[],
  ) => void;
  /** When true, renders a simplified ghost for the DragOverlay. */
  isDragOverlay?: boolean;
}

/**
 * A single column in the message moderation Kanban board.
 *
 * Responsibilities:
 * - Subscribes to its own ordered message entries via useColumnMessageEntries
 * - Renders ModerationMessageCard for each resolved message
 * - Column header with inline rename
 * - Delete column (only when empty; default inbox protected)
 * - Participates in column-level DnD reordering (draggable for custom columns)
 * - Acts as a droppable target for incoming messages
 */
export default function ModerationKanbanColumn({
  column,
  messages,
  onEntriesChange,
  isDragOverlay = false,
}: ModerationKanbanColumnProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(column.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { entries, loading: entriesLoading } = useColumnMessageEntries(
    column.id,
  );

  // Report entries upward for DnD order calculations in the board
  useEffect(() => {
    onEntriesChange(fromBranded(column.id), entries);
  }, [entries, column.id, onEntriesChange]);

  const isDefault = column.isDefault;
  const columnIdStr = fromBranded(column.id);

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `col:${columnIdStr}`,
    data: { type: "column", columnId: columnIdStr },
    disabled: isDefault, // Inbox column stays fixed
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `col-drop:${columnIdStr}`,
    data: { type: "column-drop", columnId: columnIdStr },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // ===== Column rename =====

  const handleNameSave = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === column.name) {
      setIsEditingName(false);
      setNameValue(column.name);
      return;
    }
    setIsBusy(true);
    setActionError(null);
    try {
      await updateMessageColumn(column.id, { name: trimmed });
      setIsEditingName(false);
    } catch {
      setActionError("Failed to rename column. Please try again.");
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setIsBusy(false);
    }
  };

  // ===== Column deletion =====

  const handleDeleteColumn = async () => {
    setIsBusy(true);
    setActionError(null);
    try {
      await deleteMessageColumn(column.id);
      setShowDeleteConfirm(false);
    } catch {
      setActionError("Failed to delete column. Please try again.");
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setIsBusy(false);
    }
  };

  const hasMessages = column.messageCount > 0;

  // Sorted entry IDs for SortableContext
  const itemIds = entries.map((e) => `msg:${fromBranded(e.id)}`);
  const columnMessages = entries
    .map((e) => messages.get(e.id))
    .filter((m): m is MessageDocument => m !== undefined);

  // ===== Drag overlay ghost =====

  if (isDragOverlay) {
    return (
      <div className="w-72 flex-shrink-0 rounded-xl bg-gray-800 border border-indigo-500/60 shadow-2xl opacity-90">
        <div className="px-4 py-3">
          <p className="text-sm font-semibold text-white truncate">
            {column.name}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setSortableRef}
      style={style}
      className={`flex-shrink-0 w-72 flex flex-col rounded-xl bg-gray-800 border border-gray-700 max-h-full transition-opacity ${
        isDragging ? "opacity-40" : "opacity-100"
      }`}
    >
      {/* Column header */}
      <div className="px-4 py-3 border-b border-gray-700 flex-shrink-0">
        {actionError && (
          <div role="alert" className="mb-2">
            <p className="text-xs text-red-400">{actionError}</p>
          </div>
        )}
        <div className="flex items-center gap-2">
          {/* Drag handle — custom columns only */}
          {!isDefault && (
            <button
              {...attributes}
              {...listeners}
              title="Drag to reorder column"
              tabIndex={-1}
              className="flex-shrink-0 text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle cx="9" cy="6" r="1.5" />
                <circle cx="9" cy="12" r="1.5" />
                <circle cx="9" cy="18" r="1.5" />
                <circle cx="15" cy="6" r="1.5" />
                <circle cx="15" cy="12" r="1.5" />
                <circle cx="15" cy="18" r="1.5" />
              </svg>
            </button>
          )}

          {/* Column name — click to rename */}
          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <input
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleNameSave();
                  if (e.key === "Escape") {
                    setIsEditingName(false);
                    setNameValue(column.name);
                  }
                }}
                maxLength={MAX_COLUMN_NAME_LENGTH}
                autoFocus
                disabled={isBusy}
                className="w-full rounded bg-gray-700 border border-indigo-500 px-2 py-0.5 text-sm font-semibold text-white focus:outline-none disabled:opacity-50"
              />
            ) : (
              <button
                onClick={() => {
                  setIsEditingName(true);
                  setNameValue(column.name);
                }}
                title="Click to rename"
                className="w-full text-left text-sm font-semibold text-white hover:text-indigo-300 transition-colors truncate block"
              >
                {column.name}
                {isDefault && (
                  <span className="ml-1.5 text-xs font-normal text-gray-500">
                    Inbox
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Message count badge */}
          <span className="flex-shrink-0 text-xs font-medium text-gray-500 bg-gray-700/70 rounded px-1.5 py-0.5 tabular-nums">
            {column.messageCount}
          </span>

          {/* Delete column — custom columns only */}
          {!isDefault && (
            <>
              {showDeleteConfirm ? (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={handleDeleteColumn}
                    disabled={isBusy}
                    className="text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
                  >
                    {isBusy ? "Deleting…" : "Delete"}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isBusy}
                    className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (!hasMessages) setShowDeleteConfirm(true);
                  }}
                  disabled={hasMessages}
                  title={
                    hasMessages
                      ? "Move or delete all messages before removing this column"
                      : "Delete column"
                  }
                  className="flex-shrink-0 p-1 rounded text-gray-600 hover:text-red-400 hover:bg-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Message list — scrollable, acts as droppable zone */}
      <div
        ref={setDroppableRef}
        className={`flex-1 overflow-y-auto p-3 space-y-2 min-h-[100px] transition-colors ${
          isOver ? "bg-gray-700/40" : ""
        }`}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          {entriesLoading ? (
            <p className="text-xs text-gray-600 text-center py-6">Loading…</p>
          ) : columnMessages.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-6">
              No messages
            </p>
          ) : (
            columnMessages.map((message) => (
              <ModerationMessageCard
                key={fromBranded(message.id)}
                message={message}
                columnId={column.id}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}
