"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, useEditorState, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import {
  BoldIcon, ItalicIcon, UnderlineIcon,
  H1Icon, H2Icon, H3Icon,
  ListIcon, OrderedListIcon,
  QuoteIcon, HrIcon,
  CopyIcon, DownloadIcon, TableIcon,
} from "@/components/icons";
import { createAutosave, type PatchFn } from "@/lib/autosave";
import { tiptapToMarkdown } from "@/lib/tiptap-to-markdown";
import type { TipTapNode } from "@/lib/tiptap-to-markdown";
import { toSafeFilename } from "@/lib/export";
import { TrackedInsert, TrackedDelete } from "@/lib/tiptap-tracked-changes";
import { applyTrackedChangesToEditor, resolveTrackedChanges } from "@/lib/diff-to-tiptap";
import type { DiffProposal } from "@/types/diff";

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
      className={`flex h-[30px] w-[30px] items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
        active
          ? "text-accent-deep"
          : "text-text-muted hover:bg-surface-2 hover:text-text-primary"
      }`}
      style={active ? { backgroundColor: "var(--accent-soft)" } : {}}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-[18px] w-px shrink-0 bg-border" aria-hidden="true" />;
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
  const state = useEditorState({
    editor,
    selector: ({ editor: ed }) => ({
      isH1: ed.isActive("heading", { level: 1 }),
      isH2: ed.isActive("heading", { level: 2 }),
      isH3: ed.isActive("heading", { level: 3 }),
      isBold: ed.isActive("bold"),
      isItalic: ed.isActive("italic"),
      isUnderline: ed.isActive("underline"),
      isBulletList: ed.isActive("bulletList"),
      isOrderedList: ed.isActive("orderedList"),
      isBlockquote: ed.isActive("blockquote"),
      isTable: ed.isActive("table"),
      canInsertTable: ed.can().insertTable({ rows: 3, cols: 3, withHeaderRow: true }),
    }),
  });

  const getMarkdown = () => tiptapToMarkdown(editor.getJSON() as TipTapNode);

  const handleDownloadMarkdown = () => {
    const safeFilename = `${toSafeFilename(documentName)}.md`;
    downloadBlob(getMarkdown(), safeFilename, "text/markdown");
  };

  const handleCopyMarkdown = async () => {
    await navigator.clipboard.writeText(getMarkdown());
  };

  return (
    <div
      role="toolbar"
      aria-label="Formatting toolbar"
      className="sticky top-3 z-10 mx-auto mb-6 flex w-max items-center gap-0.5 rounded-full border border-border bg-surface px-1.5 py-1 shadow-sm"
    >
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={state.isH1} label="Heading 1">
        <H1Icon className="h-[15px] w-[15px]" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={state.isH2} label="Heading 2">
        <H2Icon className="h-[15px] w-[15px]" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={state.isH3} label="Heading 3">
        <H3Icon className="h-[15px] w-[15px]" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={state.isBold} label="Bold">
        <BoldIcon className="h-[15px] w-[15px]" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={state.isItalic} label="Italic">
        <ItalicIcon className="h-[15px] w-[15px]" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={state.isUnderline} label="Underline">
        <UnderlineIcon className="h-[15px] w-[15px]" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={state.isBulletList} label="Bulleted list">
        <ListIcon className="h-[15px] w-[15px]" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={state.isOrderedList} label="Numbered list">
        <OrderedListIcon className="h-[15px] w-[15px]" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={state.isBlockquote} label="Blockquote">
        <QuoteIcon className="h-[15px] w-[15px]" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} label="Horizontal rule">
        <HrIcon className="h-[15px] w-[15px]" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        active={state.isTable}
        disabled={!state.canInsertTable}
        label="Insert table"
      >
        <TableIcon className="h-[15px] w-[15px]" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton onClick={handleCopyMarkdown} label="Copy as Markdown">
        <CopyIcon className="h-[14px] w-[14px]" />
      </ToolbarButton>
      <ToolbarButton onClick={handleDownloadMarkdown} label="Download as Markdown">
        <DownloadIcon className="h-[14px] w-[14px]" />
      </ToolbarButton>
      <a
        href={`/api/export/document/${documentId}/pdf`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Export as PDF"
        className="flex h-[30px] items-center rounded-full px-2.5 font-mono text-[10px] uppercase tracking-wider text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary"
      >
        PDF
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
  contentRef?: React.MutableRefObject<object>;
  pendingDiffs?: DiffProposal[];
  onResolveDiff?: (proposalId: string, accept: boolean) => void;
}

export default function TipTapEditor({
  documentId,
  initialJson,
  documentName,
  saveStatus,
  onSaveStatusChange,
  patchFn = defaultPatchFn,
  externalContent,
  contentRef,
  pendingDiffs = [],
  onResolveDiff,
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
  const pendingDiffsRef = useRef(pendingDiffs);
  const appliedProposalIdsRef = useRef(new Set<string>());

  useEffect(() => {
    pendingDiffsRef.current = pendingDiffs;
  }, [pendingDiffs]);

  const [activeProposalId, setActiveProposalId] = useState<string | null>(null);
  const [toolbarAnchor, setToolbarAnchor] = useState<{ top: number; left: number } | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TrackedInsert,
      TrackedDelete,
    ],
    content: initialJson,
    onUpdate({ editor: ed }) {
      const json = ed.getJSON();
      if (contentRef !== undefined) contentRef.current = json;
      if (pendingDiffsRef.current.length === 0) {
        autosaveRef.current.trigger(json);
      }
    },
    onSelectionUpdate({ editor: ed }) {
      const insertAttrs = ed.getAttributes("trackedInsert");
      const deleteAttrs = ed.getAttributes("trackedDelete");
      const rawId = insertAttrs["proposalId"] ?? deleteAttrs["proposalId"];
      const proposalId = typeof rawId === "string" ? rawId : null;
      setActiveProposalId(proposalId);
      if (proposalId !== null) {
        const coords = ed.view.coordsAtPos(ed.state.selection.from);
        setToolbarAnchor({ top: coords.top, left: coords.left });
      } else {
        setToolbarAnchor(null);
      }
    },
    editorProps: {
      attributes: {
        class:
          "editor-prose focus:outline-none min-h-[calc(100vh-16rem)]",
        "aria-label": documentName,
        role: "textbox",
        "aria-multiline": "true",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    for (const proposal of pendingDiffs) {
      if (!appliedProposalIdsRef.current.has(proposal.id)) {
        applyTrackedChangesToEditor(editor, proposal);
        appliedProposalIdsRef.current.add(proposal.id);
      }
    }
    const currentIds = new Set(pendingDiffs.map((p) => p.id));
    for (const id of appliedProposalIdsRef.current) {
      if (!currentIds.has(id)) {
        appliedProposalIdsRef.current.delete(id);
      }
    }
  }, [editor, pendingDiffs]);

  useEffect(() => {
    if (!editor || !externalContent) return;
    if (externalContent.nonce === appliedNonceRef.current) return;
    appliedNonceRef.current = externalContent.nonce;
    editor.commands.setContent(externalContent.json);
    if (contentRef !== undefined) contentRef.current = externalContent.json;
    autosaveRef.current.trigger(externalContent.json);
  }, [editor, externalContent, contentRef]);

  function handleResolveClick(proposalId: string, accept: boolean) {
    if (!editor) return;
    resolveTrackedChanges(editor, proposalId, accept);
    const json = editor.getJSON();
    if (contentRef !== undefined) contentRef.current = json;
    autosaveRef.current.trigger(json);
    onResolveDiff?.(proposalId, accept);
    setActiveProposalId(null);
    setToolbarAnchor(null);
  }

  function handleResolveAll(accept: boolean) {
    if (!editor) return;
    for (const proposal of pendingDiffs) {
      resolveTrackedChanges(editor, proposal.id, accept);
    }
    const json = editor.getJSON();
    if (contentRef !== undefined) contentRef.current = json;
    autosaveRef.current.trigger(json);
    for (const proposal of pendingDiffs) {
      onResolveDiff?.(proposal.id, accept);
    }
    setActiveProposalId(null);
    setToolbarAnchor(null);
  }

  return (
    <div className="mx-auto max-w-[760px] px-14 pt-8 pb-32">
      {editor && (
        <Toolbar editor={editor} documentId={documentId} documentName={documentName} />
      )}
      <div className="flex justify-end pb-3">
        <SaveIndicator status={saveStatus} />
      </div>
      <EditorContent editor={editor} data-testid="tiptap-editor" />
      {activeProposalId !== null && toolbarAnchor !== null && (
        <div
          role="toolbar"
          aria-label="Accept or reject tracked change"
          style={{
            position: "fixed",
            top: Math.max(8, toolbarAnchor.top - 44),
            left: toolbarAnchor.left,
            zIndex: 50,
          }}
          className="flex items-center gap-1 rounded border border-border bg-surface px-2 py-1 shadow-lg"
        >
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              handleResolveClick(activeProposalId, true);
            }}
            className="rounded bg-green-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-green-700"
          >
            Accept
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              handleResolveClick(activeProposalId, false);
            }}
            className="rounded bg-red-500 px-2 py-0.5 text-xs font-medium text-white hover:bg-red-600"
          >
            Reject
          </button>
          {pendingDiffs.length > 1 && (
            <>
              <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleResolveAll(true);
                }}
                className="rounded px-2 py-0.5 text-xs text-green-700 hover:bg-green-50"
              >
                Accept all
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleResolveAll(false);
                }}
                className="rounded px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
              >
                Reject all
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
