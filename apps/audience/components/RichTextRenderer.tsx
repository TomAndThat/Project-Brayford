"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import { useEffect } from "react";
import type { JSONContent } from "@tiptap/react";

interface RichTextRendererProps {
  content: JSONContent | string;
  className?: string;
}

/**
 * Rich Text Renderer Component for Audience View
 *
 * Displays rich text content in read-only mode.
 * Supports all formatting from the editor:
 * - Basic formatting (bold, italic, underline, strikethrough)
 * - Headings (H1-H6)
 * - Lists (ordered and unordered)
 * - Links (clickable)
 * - Text color
 * - Code blocks and inline code
 */
/**
 * Strips trailing empty paragraph nodes from Tiptap JSONContent.
 *
 * ProseMirror always appends an empty paragraph after non-paragraph nodes
 * (e.g. headings) so the cursor has a valid position. This can get
 * persisted to the database and renders as a blank line. We remove it
 * here so existing stored content displays cleanly, even before the
 * creator re-saves.
 */
function stripTrailingEmptyParagraphs(content: JSONContent): JSONContent {
  if (!content.content || content.content.length === 0) return content;
  const nodes = [...content.content];
  while (nodes.length > 0) {
    const last = nodes[nodes.length - 1];
    const isEmpty =
      last.type === "paragraph" && (!last.content || last.content.length === 0);
    if (isEmpty) {
      nodes.pop();
    } else {
      break;
    }
  }
  return { ...content, content: nodes };
}

export default function RichTextRenderer({
  content,
  className = "",
}: RichTextRendererProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        code: false,
        codeBlock: false,
      }),
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          class: "text-blue-600 underline hover:text-blue-800",
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content:
      typeof content === "string"
        ? content
        : stripTrailingEmptyParagraphs(content),
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none",
      },
    },
  });

  // Update editor content when prop changes
  useEffect(() => {
    if (!editor) return;
    const cleaned =
      typeof content === "string"
        ? content
        : stripTrailingEmptyParagraphs(content);
    if (JSON.stringify(cleaned) !== JSON.stringify(editor.getJSON())) {
      editor.commands.setContent(cleaned);
    }
  }, [editor, content]);

  if (!editor) {
    return null;
  }

  return (
    <div className={className}>
      <EditorContent editor={editor} />
    </div>
  );
}
