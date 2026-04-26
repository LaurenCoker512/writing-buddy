"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { createAutosave, type PatchFn } from "@/lib/autosave";
import { tiptapToMarkdown } from "@/lib/tiptap-to-markdown";
import type { TipTapNode } from "@/lib/tiptap-to-markdown";

// ── Toolbar ───────────────────────────────────────────────────────────────────

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className={`rounded px-2 py-1 text-sm font-medium transition-colors disabled:opacity-40 ${
        active
          ? "bg-accent/10 text-accent"
          : "text-text-muted hover:bg-background hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />;
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function Toolbar({
  editor,
  documentId,
  documentName,
}: {
  editor: Editor;
  documentId: string;
  documentName: string;
}) {
  const getMarkdown = () => tiptapToMarkdown(editor.getJSON() as TipTapNode);

  const handleDownloadMarkdown = () => {
    const safeFilename = `${documentName.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-")}.md`;
    downloadBlob(getMarkdown(), safeFilename, "text/markdown");
  };

  const handleCopyMarkdown = async () => {
    await navigator.clipboard.writeText(getMarkdown());
  };

  return (
    <div
      role="toolbar"
      aria-label="Formatting toolbar"
      className="flex flex-wrap items-center gap-0.5 border-b border-border bg-surface px-3 py-1.5"
    >
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive("heading", { level: 1 })}
        label="Heading 1"
      >
        H1
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
        label="Heading 2"
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })}
        label="Heading 3"
      >
        H3
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        label="Bold"
      >
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        label="Italic"
      >
        <em>I</em>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive("underline")}
        label="Underline"
      >
        <span className="underline">U</span>
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        label="Bulleted list"
      >
        ≡
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        label="Numbered list"
      >
        1≡
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
        active={editor.isActive("table")}
        disabled={!editor.can().insertTable({ rows: 3, cols: 3, withHeaderRow: true })}
        label="Insert table"
      >
        ⊞
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        label="Horizontal rule"
      >
        ─
      </ToolbarButton>

      <Divider />

      <ToolbarButton onClick={handleDownloadMarkdown} label="Download as Markdown">
        ↓ .md
      </ToolbarButton>
      <ToolbarButton onClick={handleCopyMarkdown} label="Copy as Markdown">
        ⎘ md
      </ToolbarButton>
      <a
        href={`/api/export/document/${documentId}/pdf`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Export as PDF"
        className="rounded px-2 py-1 text-sm font-medium text-text-muted transition-colors hover:bg-background hover:text-text-primary"
      >
        ↓ PDF
      </a>
    </div>
  );
}

// ── Status ────────────────────────────────────────────────────────────────────

type SaveStatus = "idle" | "saving" | "saved" | "error";

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  const labels: Record<SaveStatus, string> = {
    idle: "",
    saving: "Saving…",
    saved: "Saved",
    error: "Save failed",
  };
  const colors: Record<SaveStatus, string> = {
    idle: "",
    saving: "text-text-muted",
    saved: "text-accent-ai",
    error: "text-red-500",
  };
  return (
    <span className={`text-xs ${colors[status]}`} aria-live="polite">
      {labels[status]}
    </span>
  );
}

// ── Editor ────────────────────────────────────────────────────────────────────

const AUTOSAVE_DELAY_MS = 2000;

const defaultPatchFn: PatchFn = async (documentId, tiptapJson) => {
  const res = await fetch(`/api/documents/${documentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tiptapJson }),
  });
  return res.ok;
};

interface TipTapEditorProps {
  documentId: string;
  initialJson: object;
  documentName: string;
  saveStatus: SaveStatus;
  onSaveStatusChange: (status: SaveStatus) => void;
  patchFn?: PatchFn;
  externalContent?: { json: object; nonce: number };
}

export default function TipTapEditor({
  documentId,
  initialJson,
  documentName,
  saveStatus,
  onSaveStatusChange,
  patchFn = defaultPatchFn,
  externalContent,
}: TipTapEditorProps) {
  const autosaveRef = useRef(
    createAutosave(documentId, AUTOSAVE_DELAY_MS, async (id, json) => {
      onSaveStatusChange("saving");
      const ok = await patchFn(id, json);
      onSaveStatusChange(ok ? "saved" : "error");
      return ok;
    }),
  );

  useEffect(() => {
    const autosave = autosaveRef.current;
    return () => autosave.cancel();
  }, []);

  const appliedNonceRef = useRef(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: initialJson,
    onUpdate({ editor: ed }) {
      autosaveRef.current.trigger(ed.getJSON());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none min-h-[calc(100vh-12rem)] px-8 py-6",
        "aria-label": documentName,
        role: "textbox",
        "aria-multiline": "true",
      },
    },
  });

  useEffect(() => {
    if (!editor || !externalContent) return;
    if (externalContent.nonce === appliedNonceRef.current) return;
    appliedNonceRef.current = externalContent.nonce;
    editor.commands.setContent(externalContent.json);
    autosaveRef.current.trigger(externalContent.json);
  }, [editor, externalContent]);

  return (
    <div className="flex flex-col">
      {editor && (
        <Toolbar editor={editor} documentId={documentId} documentName={documentName} />
      )}
      <div className="flex items-center justify-end border-b border-border bg-surface px-4 py-1">
        <SaveIndicator status={saveStatus} />
      </div>
      <div className="overflow-auto">
        <EditorContent editor={editor} data-testid="tiptap-editor" />
      </div>
    </div>
  );
}
