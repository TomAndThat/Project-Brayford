"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  softDeleteMessage,
  removeMessageFromColumn,
  editMessage,
  clearMessageEdit,
} from "@brayford/firebase-utils";
import {
  type MessageDocument,
  type MessageColumnId,
  MAX_MESSAGE_CONTENT_LENGTH,
  fromBranded,
} from "@brayford/core";

interface ModerationMessageCardProps {
  message: MessageDocument;
  columnId: MessageColumnId;
  /** When true, renders a simplified ghost for the DragOverlay. */
  isDragOverlay?: boolean;
}

/**
 * A single message card on the moderation Kanban board.
 *
 * Supports:
 * - Drag-and-drop (via useSortable) within and between columns
 * - Inline text editing (writes to editedContent, preserving the original)
 * - Soft deletion with an inline confirmation step
 *   — Shift+click bypasses confirmation for high-throughput moderation
 * - One-click revert of any moderator edits
 */
export default function ModerationMessageCard({
  message,
  columnId,
  isDragOverlay = false,
}: ModerationMessageCardProps) {
  const [deleteState, setDeleteState] = useState<"idle" | "confirm">("idle");
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `msg:${fromBranded(message.id)}`,
    data: {
      type: "message",
      messageId: fromBranded(message.id),
      columnId: fromBranded(columnId),
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const displayContent = message.editedContent ?? message.content;
  const displayName = message.displayName ?? "Anonymous";
  const hasEdit = message.editedContent !== null;

  const submittedAt =
    message.submittedAt instanceof Date
      ? message.submittedAt.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

  // ===== Delete =====

  const handleDeleteClick = async (e: React.MouseEvent) => {
    if (isBusy) return;
    if (e.shiftKey) {
      await doDelete();
    } else {
      setDeleteState("confirm");
    }
  };

  const doDelete = async () => {
    setIsBusy(true);
    try {
      await softDeleteMessage(message.id);
      await removeMessageFromColumn(message.id, columnId);
    } finally {
      setIsBusy(false);
      setDeleteState("idle");
    }
  };

  // ===== Edit =====

  const handleEditOpen = () => {
    setEditValue(message.editedContent ?? message.content);
    setEditError(null);
    setIsEditing(true);
  };

  const handleEditSave = async () => {
    const trimmed = editValue.trim();
    if (!trimmed) {
      setEditError("Message cannot be empty.");
      return;
    }
    if (trimmed.length > MAX_MESSAGE_CONTENT_LENGTH) {
      setEditError(
        `Message must not exceed ${MAX_MESSAGE_CONTENT_LENGTH} characters.`,
      );
      return;
    }
    setIsBusy(true);
    try {
      await editMessage(message.id, trimmed);
      setIsEditing(false);
      setEditValue("");
    } finally {
      setIsBusy(false);
    }
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditValue("");
    setEditError(null);
  };

  const handleRevertEdit = async () => {
    setIsBusy(true);
    try {
      await clearMessageEdit(message.id);
    } finally {
      setIsBusy(false);
    }
  };

  // ===== Drag overlay ghost =====

  if (isDragOverlay) {
    return (
      <div className="rounded-lg bg-gray-700 border border-indigo-500 p-3 shadow-2xl cursor-grabbing w-72">
        <p className="text-xs font-medium text-indigo-400 mb-1 truncate">
          {displayName}
        </p>
        <p className="text-sm text-gray-200 line-clamp-2">{displayContent}</p>
      </div>
    );
  }

  // ===== Edit mode =====

  if (isEditing) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="rounded-lg bg-gray-800 border border-indigo-500 p-3 space-y-2"
      >
        <textarea
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value);
            setEditError(null);
          }}
          rows={3}
          maxLength={MAX_MESSAGE_CONTENT_LENGTH}
          disabled={isBusy}
          autoFocus
          className="w-full rounded-lg bg-gray-900 border border-gray-600 px-2.5 py-1.5 text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        />
        {editError && (
          <p role="alert" className="text-xs text-red-400">
            {editError}
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleEditSave}
            disabled={isBusy || !editValue.trim()}
            className="px-3 py-1 text-xs font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isBusy ? "Saving…" : "Save"}
          </button>
          <button
            onClick={handleEditCancel}
            disabled={isBusy}
            className="px-3 py-1 text-xs font-medium rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ===== Delete confirmation inline =====

  if (deleteState === "confirm") {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="rounded-lg bg-gray-800 border border-red-800 p-3"
      >
        <p className="text-xs text-gray-300 mb-2.5">
          Remove this message? This cannot be undone.
        </p>
        <div className="flex gap-2">
          <button
            onClick={doDelete}
            disabled={isBusy}
            className="px-3 py-1 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-500 disabled:opacity-50"
          >
            {isBusy ? "Removing…" : "Remove"}
          </button>
          <button
            onClick={() => setDeleteState("idle")}
            disabled={isBusy}
            className="px-3 py-1 text-xs font-medium rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ===== Normal view =====

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg bg-gray-800 border border-gray-700 transition-opacity ${
        isDragging ? "opacity-0" : "opacity-100"
      } ${isBusy ? "pointer-events-none opacity-60" : ""}`}
    >
      <div className="p-3">
        <div className="flex items-start gap-2">
          {/* Message content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <p className="text-xs font-medium text-indigo-400 truncate">
                {displayName}
              </p>
              {submittedAt && (
                <span className="text-xs text-gray-600 flex-shrink-0">
                  {submittedAt}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-200 break-words leading-relaxed">
              {displayContent}
            </p>
            {hasEdit && (
              <div className="mt-1.5 flex items-center gap-1">
                <span className="text-xs text-gray-500">Edited</span>
                <span className="text-gray-600">·</span>
                <button
                  onClick={handleRevertEdit}
                  className="text-xs text-gray-500 hover:text-gray-300 underline transition-colors"
                >
                  Revert to original
                </button>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
            {/* Edit */}
            <button
              onClick={handleEditOpen}
              title="Edit message"
              className="p-1.5 rounded text-gray-600 hover:text-gray-300 hover:bg-gray-700 transition-colors"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>

            {/* Delete — Shift+click skips confirmation */}
            <button
              onClick={handleDeleteClick}
              title="Delete (Shift+click to skip confirmation)"
              className="p-1.5 rounded text-gray-600 hover:text-red-400 hover:bg-gray-700 transition-colors"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>

            {/* Drag handle */}
            <button
              {...attributes}
              {...listeners}
              title="Drag to move"
              className="p-1.5 rounded text-gray-700 hover:text-gray-400 hover:bg-gray-700 transition-colors cursor-grab active:cursor-grabbing"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <circle cx="9" cy="6" r="1.5" />
                <circle cx="9" cy="12" r="1.5" />
                <circle cx="9" cy="18" r="1.5" />
                <circle cx="15" cy="6" r="1.5" />
                <circle cx="15" cy="12" r="1.5" />
                <circle cx="15" cy="18" r="1.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
