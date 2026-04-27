"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  DocumentItem,
  NodeType,
  ProjectTree,
  SeriesItem,
  StoryItem,
  UniverseItem,
} from "@/types/project-tree";
import {
  DOCUMENT_SECTION_LABELS,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_ORDER,
  type DocumentTypeValue,
} from "@/lib/documents";
import { calculateInsertOrder } from "@/lib/scene-order";
import CanonIngestionModal from "@/components/CanonIngestionModal";
import ContradictionCheckerModal from "@/components/ContradictionCheckerModal";
import { shouldShowAgeGate } from "@/lib/age-gate";

// ── Icons ─────────────────────────────────────────────────────────────────────

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 1.5C6.5 4 5.5 6 5.5 8s1 4 2.5 6.5M8 1.5C9.5 4 10.5 6 10.5 8s-1 4-2.5 6.5" />
      <path d="M1.5 8h13" />
    </svg>
  );
}

function LayersIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      aria-hidden="true"
    >
      <path d="M1.5 5.5L8 2l6.5 3.5-6.5 3.5L1.5 5.5z" />
      <path d="M1.5 9.5L8 13l6.5-3.5" />
    </svg>
  );
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" />
      <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" />
    </svg>
  );
}

function ChevronIcon({
  expanded,
  className,
}: {
  expanded: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`transition-transform duration-150 ${expanded ? "rotate-90" : ""} ${className ?? ""}`}
      aria-hidden="true"
    >
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

function DotsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <circle cx="3" cy="8" r="1.25" />
      <circle cx="8" cy="8" r="1.25" />
      <circle cx="13" cy="8" r="1.25" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

function CollapseIcon({
  collapsed,
  className,
}: {
  collapsed: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      aria-hidden="true"
    >
      {collapsed ? (
        <path d="M6 4l4 4-4 4" />
      ) : (
        <path d="M10 4L6 8l4 4" />
      )}
    </svg>
  );
}

function PromptsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 2h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
      <path d="M5 6h6M5 9h4" />
    </svg>
  );
}

function BrainstormIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 1.5a5 5 0 0 1 3.5 8.5l-.5 1H5l-.5-1A5 5 0 0 1 8 1.5Z" />
      <path d="M6 11v1.5a2 2 0 0 0 4 0V11" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M11.3 4.7l-1.3 1.3M4.7 11.3l-1.3 1.3" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 2h7l3 3v9H3V2z" />
      <path d="M10 2v3h3" />
      <path d="M5.5 7h5M5.5 9.5h5M5.5 12h3" />
    </svg>
  );
}

function GripIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <circle cx="5.5" cy="4" r="1.2" />
      <circle cx="5.5" cy="8" r="1.2" />
      <circle cx="5.5" cy="12" r="1.2" />
      <circle cx="10.5" cy="4" r="1.2" />
      <circle cx="10.5" cy="8" r="1.2" />
      <circle cx="10.5" cy="12" r="1.2" />
    </svg>
  );
}

function GraphIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      aria-hidden="true"
    >
      <circle cx="3" cy="8" r="2" />
      <circle cx="13" cy="3.5" r="2" />
      <circle cx="13" cy="12.5" r="2" />
      <path d="M5 8h3.5M11 4.5l-2.5 3M11 11.5l-2.5-3" />
    </svg>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ContextMenuState {
  id: string;
  type: NodeType;
  name: string;
  x: number;
  y: number;
  meta?: Record<string, unknown> | null;
  docType?: string;
}

interface ModalState {
  id: string;
  type: NodeType;
  name: string;
}

interface CreateData {
  itemType: NodeType;
  name: string;
  mode: string;
  rating: string;
  sourceTitle?: string;
  universeId?: string;
  seriesId?: string;
}

interface CanonIngestionState {
  universeId: string;
  universeName: string;
}

interface NewDocumentState {
  storyId: string;
  storyName: string;
  storyMode?: string;
}

// ── Context Menu ──────────────────────────────────────────────────────────────

function ContextMenuDropdown({
  menu,
  onRename,
  onDelete,
  onClose,
  onImportCanon,
  onDuplicateAsAu,
  onCheckContradictions,
}: {
  menu: ContextMenuState;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
  onImportCanon?: () => void;
  onDuplicateAsAu?: () => void;
  onCheckContradictions?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const menuItemClass =
    "block w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-background";

  return (
    <div
      ref={ref}
      role="menu"
      data-testid="context-menu"
      className="fixed z-50 min-w-[140px] rounded border border-border bg-surface py-1 shadow-lg"
      style={{ top: menu.y, left: menu.x }}
    >
      <button role="menuitem" className={menuItemClass} onClick={onRename}>
        Rename
      </button>
      {menu.type === "universe" && onImportCanon !== undefined && (
        <button role="menuitem" className={menuItemClass} onClick={onImportCanon}>
          Import Canon Text
        </button>
      )}
      {menu.type === "story" && onCheckContradictions !== undefined && (
        <button role="menuitem" className={menuItemClass} onClick={onCheckContradictions}>
          Check for Contradictions
        </button>
      )}
      {menu.type === "document" && (
        <>
          {(menu.docType === "CHARACTER" || menu.docType === "WORLDBUILDING") &&
            menu.meta?.isCanon === true &&
            onDuplicateAsAu !== undefined && (
              <button role="menuitem" className={menuItemClass} onClick={onDuplicateAsAu}>
                Duplicate as AU
              </button>
            )}
          <a
            role="menuitem"
            href={`/api/export/document/${menu.id}/markdown`}
            download
            className={menuItemClass}
            onClick={onClose}
          >
            Export as Markdown
          </a>
          <a
            role="menuitem"
            href={`/api/export/document/${menu.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className={menuItemClass}
            onClick={onClose}
          >
            Export as PDF
          </a>
        </>
      )}
      <button
        role="menuitem"
        className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-background"
        onClick={onDelete}
      >
        Delete
      </button>
    </div>
  );
}

// ── Rename Modal ──────────────────────────────────────────────────────────────

function RenameModal({
  modal,
  onConfirm,
  onClose,
}: {
  modal: ModalState;
  onConfirm: (name: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(modal.name);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === modal.name) {
      onClose();
      return;
    }
    setSaving(true);
    onConfirm(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 font-heading text-lg font-semibold text-text-primary">
          Rename {modal.type}
        </h2>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onClose();
          }}
          className="mb-4 w-full rounded border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
          aria-label="New name"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded border border-border px-4 py-2 text-sm text-text-muted hover:bg-background"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || !value.trim()}
            className="rounded bg-accent px-4 py-2 text-sm text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {saving ? "Saving…" : "Rename"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Modal ──────────────────────────────────────────────────────────────

function DeleteModal({
  modal,
  onConfirm,
  onClose,
}: {
  modal: ModalState;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-2 font-heading text-lg font-semibold text-text-primary">
          Delete {modal.type}?
        </h2>
        <p className="mb-6 text-sm text-text-muted">
          {modal.type === "document" ? (
            <>
              &ldquo;{modal.name}&rdquo; will be permanently deleted along with
              its versions and chat history.
            </>
          ) : (
            <>
              &ldquo;{modal.name}&rdquo; will be permanently deleted. Children
              (series, stories) will be orphaned, not deleted.
            </>
          )}
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded border border-border px-4 py-2 text-sm text-text-muted hover:bg-background"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Age Gate Modal ────────────────────────────────────────────────────────────

function AgeGateModal({
  onConfirm,
  onClose,
  confirming,
}: {
  onConfirm: () => void;
  onClose: () => void;
  confirming: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="age-gate-modal"
      >
        <h2 className="mb-2 font-heading text-lg font-semibold text-text-primary">
          Age Confirmation Required
        </h2>
        <p className="mb-6 text-sm text-text-muted">
          Explicit-rated (E) content is intended for adults only. By continuing,
          you confirm you are 18 years of age or older.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={confirming}
            className="rounded border border-border px-4 py-2 text-sm text-text-muted hover:bg-background disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={confirming}
            className="rounded bg-accent px-4 py-2 text-sm text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {confirming ? "Confirming…" : "I am 18+, Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── New Project Modal ─────────────────────────────────────────────────────────

function NewProjectModal({
  tree,
  onConfirm,
  onClose,
}: {
  tree: ProjectTree;
  onConfirm: (data: CreateData) => void;
  onClose: () => void;
}) {
  const [itemType, setItemType] = useState<NodeType>("story");
  const [name, setName] = useState("");
  const [mode, setMode] = useState("ORIGINAL");
  const [rating, setRating] = useState("G");
  const [sourceTitle, setSourceTitle] = useState("");
  const [universeId, setUniverseId] = useState("");
  const [seriesId, setSeriesId] = useState("");
  const [saving, setSaving] = useState(false);
  const [explicitEnabled, setExplicitEnabled] = useState<boolean | null>(null);
  const [showAgeGate, setShowAgeGate] = useState(false);
  const [enablingExplicit, setEnablingExplicit] = useState(false);

  const handleRatingClick = async (r: string) => {
    if (r !== "E") {
      setRating(r);
      return;
    }
    let enabled = explicitEnabled;
    if (enabled === null) {
      const res = await fetch("/api/account");
      if (res.ok) {
        const data = (await res.json()) as { explicitEnabled: boolean };
        enabled = data.explicitEnabled;
        setExplicitEnabled(enabled);
      }
    }
    if (shouldShowAgeGate(enabled ?? false, "E")) {
      setShowAgeGate(true);
    } else {
      setRating("E");
    }
  };

  const handleAgeGateConfirm = async () => {
    setEnablingExplicit(true);
    await fetch("/api/account/explicit-enable", { method: "PATCH" });
    setExplicitEnabled(true);
    setShowAgeGate(false);
    setRating("E");
    setEnablingExplicit(false);
  };

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    onConfirm({
      itemType,
      name: trimmed,
      mode,
      rating,
      sourceTitle: mode === "FANFIC" && sourceTitle.trim() ? sourceTitle.trim() : undefined,
      universeId: universeId || undefined,
      seriesId: seriesId || undefined,
    });
  };

  const allSeries = [
    ...tree.universes.flatMap((u) => u.series),
    ...tree.standaloneSeries,
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="new-project-modal"
      >
        <h2 className="mb-4 font-heading text-lg font-semibold text-text-primary">
          New Project
        </h2>

        {/* Type */}
        <fieldset className="mb-4">
          <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-text-muted">
            Type
          </legend>
          <div className="flex gap-2">
            {(["universe", "series", "story"] as NodeType[]).map((t) => (
              <button
                key={t}
                onClick={() => setItemType(t)}
                className={`flex-1 rounded border px-3 py-1.5 text-sm capitalize transition-colors ${
                  itemType === t
                    ? "border-accent bg-accent text-white"
                    : "border-border text-text-muted hover:border-accent hover:text-text-primary"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Name */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-muted">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") onClose();
            }}
            autoFocus
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
            aria-label="Project name"
          />
        </div>

        {/* Parent Universe (for series and story) */}
        {(itemType === "series" || itemType === "story") &&
          tree.universes.length > 0 && (
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-muted">
                Universe (optional)
              </label>
              <select
                value={universeId}
                onChange={(e) => {
                  setUniverseId(e.target.value);
                  setSeriesId("");
                }}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">— None —</option>
                {tree.universes.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}

        {/* Parent Series (for story) */}
        {itemType === "story" && allSeries.length > 0 && (
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-muted">
              Series (optional)
            </label>
            <select
              value={seriesId}
              onChange={(e) => setSeriesId(e.target.value)}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">— None —</option>
              {allSeries.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Mode */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-muted">
            Mode
          </label>
          <div className="flex gap-2">
            {["ORIGINAL", "FANFIC"].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded border px-3 py-1.5 text-sm transition-colors ${
                  mode === m
                    ? "border-accent bg-accent text-white"
                    : "border-border text-text-muted hover:border-accent hover:text-text-primary"
                }`}
              >
                {m === "ORIGINAL" ? "Original" : "Fanfic"}
              </button>
            ))}
          </div>
        </div>

        {/* Source Title (Fanfic only) */}
        {mode === "FANFIC" && (
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-muted">
              Source Title (optional)
            </label>
            <input
              type="text"
              value={sourceTitle}
              onChange={(e) => setSourceTitle(e.target.value)}
              placeholder="e.g. Harry Potter, Star Wars…"
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
              aria-label="Source title"
            />
          </div>
        )}

        {/* Rating */}
        <div className="mb-6">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-muted">
            Rating
          </label>
          <div className="flex gap-2">
            {["G", "T", "M", "E"].map((r) => (
              <button
                key={r}
                onClick={() => void handleRatingClick(r)}
                className={`flex-1 rounded border px-3 py-1.5 text-sm transition-colors ${
                  rating === r
                    ? "border-accent bg-accent text-white"
                    : "border-border text-text-muted hover:border-accent hover:text-text-primary"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {showAgeGate && (
          <AgeGateModal
            onConfirm={() => void handleAgeGateConfirm()}
            onClose={() => setShowAgeGate(false)}
            confirming={enablingExplicit}
          />
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded border border-border px-4 py-2 text-sm text-text-muted hover:bg-background"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || !name.trim()}
            className="rounded bg-accent px-4 py-2 text-sm text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── New Document Modal ────────────────────────────────────────────────────────

function NewDocumentModal({
  storyId,
  storyName,
  storyMode,
  onConfirm,
  onClose,
}: {
  storyId: string;
  storyName: string;
  storyMode?: string;
  onConfirm: (type: DocumentTypeValue, name: string, sourceText?: string) => void;
  onClose: () => void;
}) {
  const [docType, setDocType] = useState<DocumentTypeValue>("CHARACTER");
  const [name, setName] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [saving, setSaving] = useState(false);

  const showSourceText = storyMode === "FANFIC" && docType === "CHARACTER";

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    onConfirm(docType, trimmed, showSourceText && sourceText.trim() ? sourceText.trim() : undefined);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="new-document-modal"
      >
        <h2 className="mb-1 font-heading text-lg font-semibold text-text-primary">
          New Document
        </h2>
        <p className="mb-4 text-xs text-text-muted">In: {storyName}</p>

        <fieldset className="mb-4">
          <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-text-muted">
            Type
          </legend>
          <div className="grid grid-cols-3 gap-1.5">
            {DOCUMENT_TYPE_ORDER.map((type) => (
              <button
                key={type}
                onClick={() => setDocType(type)}
                className={`rounded border px-2 py-1.5 text-xs transition-colors ${
                  docType === type
                    ? "border-accent bg-accent text-white"
                    : "border-border text-text-muted hover:border-accent hover:text-text-primary"
                }`}
              >
                {DOCUMENT_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-muted">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") onClose();
            }}
            autoFocus
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
            aria-label="Document name"
          />
        </div>

        {showSourceText && (
          <div className="mb-6">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-muted">
              Source Material (optional)
            </label>
            <p className="mb-1.5 text-xs text-text-muted">
              Paste wiki text or bios to pre-populate the document via AI diff.
            </p>
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              rows={4}
              className="w-full resize-none rounded border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
              aria-label="Source material for character pre-population"
            />
          </div>
        )}

        {!showSourceText && <div className="mb-6" />}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded border border-border px-4 py-2 text-sm text-text-muted hover:bg-background"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || !name.trim()}
            className="rounded bg-accent px-4 py-2 text-sm text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Scene Drag-and-Drop ───────────────────────────────────────────────────────

function SortableSceneItem({
  doc,
  depth,
  isActive,
  collapsed,
  onContextMenu,
}: {
  doc: DocumentItem;
  depth: number;
  isActive: boolean;
  collapsed: boolean;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: doc.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} {...attributes}>
      <div
        className={`group flex items-center gap-1.5 rounded px-2 py-1.5 text-sm transition-colors ${
          isActive
            ? "bg-accent/10 text-accent"
            : "text-text-primary hover:bg-background"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {!collapsed && (
          <button
            {...listeners}
            className="shrink-0 cursor-grab text-text-muted opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
            aria-label={`Drag to reorder ${doc.name}`}
            tabIndex={-1}
          >
            <GripIcon className="h-3 w-3" />
          </button>
        )}
        <Link
          href={`/dashboard/documents/${doc.id}`}
          className="flex flex-1 items-center gap-1.5 truncate"
          data-testid={`document-node-${doc.id}`}
          aria-label={doc.name}
          aria-current={isActive ? "page" : undefined}
        >
          <FileIcon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
          {!collapsed && <span className="truncate">{doc.name}</span>}
        </Link>
        {!collapsed && (
          <button
            onClick={onContextMenu}
            className="invisible shrink-0 rounded p-0.5 text-text-muted hover:bg-border group-hover:visible"
            aria-label={`Options for ${doc.name}`}
            data-testid={`document-menu-${doc.id}`}
          >
            <DotsIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </li>
  );
}

function SortableSceneList({
  docs: initialDocs,
  depth,
  pathname,
  collapsed,
  onContextMenu,
}: {
  docs: DocumentItem[];
  depth: number;
  pathname: string;
  collapsed: boolean;
  onContextMenu: (
    e: React.MouseEvent,
    id: string,
    name: string,
    meta?: Record<string, unknown> | null,
    docType?: string,
  ) => void;
}) {
  const [docs, setDocs] = useState(initialDocs);

  useEffect(() => {
    setDocs(initialDocs);
  }, [initialDocs]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = docs.findIndex((d) => d.id === active.id);
    const newIndex = docs.findIndex((d) => d.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(docs, oldIndex, newIndex);
    const otherOrders = reordered
      .filter((d) => d.id !== active.id)
      .map((d) => d.order);
    const newOrder = calculateInsertOrder(otherOrders, newIndex);

    setDocs(reordered.map((d) => (d.id === active.id ? { ...d, order: newOrder } : d)));

    void fetch(`/api/documents/${String(active.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: newOrder }),
    });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={docs.map((d) => d.id)} strategy={verticalListSortingStrategy}>
        {docs.map((doc) => (
          <SortableSceneItem
            key={doc.id}
            doc={doc}
            depth={depth}
            isActive={pathname === `/dashboard/documents/${doc.id}`}
            collapsed={collapsed}
            onContextMenu={(e) => onContextMenu(e, doc.id, doc.name, doc.meta, doc.type)}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [tree, setTree] = useState<ProjectTree | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renameModal, setRenameModal] = useState<ModalState | null>(null);
  const [deleteModal, setDeleteModal] = useState<ModalState | null>(null);
  const [newProjectModal, setNewProjectModal] = useState(false);
  const [newDocumentModal, setNewDocumentModal] = useState<NewDocumentState | null>(null);
  const [canonIngestionModal, setCanonIngestionModal] = useState<CanonIngestionState | null>(null);
  const [contradictionModal, setContradictionModal] = useState<{ storyId: string; storyName: string } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  const fetchTree = useCallback(async () => {
    try {
      const res = await fetch("/api/project-tree");
      if (!res.ok) return;
      const data = (await res.json()) as ProjectTree;
      setTree(data);
      setExpanded((prev) => {
        const next = new Set(prev);
        data.universes.forEach((u) => next.add(u.id));
        data.standaloneSeries.forEach((s) => next.add(s.id));
        return next;
      });
    } catch {
      // network errors are non-fatal for the sidebar
    }
  }, []);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openContextMenu = (
    e: React.MouseEvent,
    id: string,
    type: NodeType,
    name: string,
    meta?: Record<string, unknown> | null,
    docType?: string,
  ) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setContextMenu({ id, type, name, x: rect.right + 4, y: rect.top, meta, docType });
  };

  const handleRename = async (name: string) => {
    if (!renameModal) return;
    await fetch(`/api/${renameModal.type}s/${renameModal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setRenameModal(null);
    fetchTree();
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    await fetch(`/api/${deleteModal.type}s/${deleteModal.id}`, {
      method: "DELETE",
    });
    setDeleteModal(null);
    fetchTree();
  };

  const handleDocumentCreate = async (
    storyId: string,
    type: DocumentTypeValue,
    name: string,
    sourceText?: string,
  ) => {
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, name, storyId }),
    });
    setNewDocumentModal(null);
    fetchTree();

    if (sourceText && res.ok) {
      const created = (await res.json()) as { id: string };
      const prepopRes = await fetch("/api/ai/prepopulate-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: created.id, sourceText }),
      });
      if (prepopRes.ok) {
        const data = (await prepopRes.json()) as { proposals: unknown[] };
        if (Array.isArray(data.proposals) && data.proposals.length > 0) {
          sessionStorage.setItem(`prepopulate-${created.id}`, JSON.stringify(data.proposals));
        }
      }
      router.push(`/dashboard/documents/${created.id}`);
    }
  };

  const handleDuplicateAsAu = async () => {
    if (!contextMenu) return;
    const res = await fetch(`/api/documents/${contextMenu.id}/duplicate`, {
      method: "POST",
    });
    setContextMenu(null);
    if (res.ok) fetchTree();
  };

  const handleCreate = async (data: CreateData) => {
    const endpoint = `/api/${data.itemType}s`;
    const body: Record<string, unknown> = {
      name: data.name,
      mode: data.mode,
      rating: data.rating,
    };
    if (data.sourceTitle) body.sourceTitle = data.sourceTitle;
    if (data.itemType === "series" && data.universeId) {
      body.universeId = data.universeId;
    }
    if (data.itemType === "story") {
      if (data.universeId) body.universeId = data.universeId;
      if (data.seriesId) body.seriesId = data.seriesId;
    }
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setNewProjectModal(false);
    fetchTree();
    if (data.itemType === "universe" && data.mode === "FANFIC" && res.ok) {
      const created = (await res.json()) as { id: string };
      setCanonIngestionModal({ universeId: created.id, universeName: data.name });
    }
  };

  // ── Tree node renderers ────────────────────────────────────────────────────

  const renderDocumentNode = (doc: DocumentItem, depth: number) => {
    const isActive = pathname === `/dashboard/documents/${doc.id}`;
    return (
    <li key={doc.id}>
      <div
        className={`group flex items-center gap-1.5 rounded px-2 py-1.5 text-sm transition-colors ${
          isActive
            ? "bg-accent/10 text-accent"
            : "text-text-primary hover:bg-background"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <Link
          href={`/dashboard/documents/${doc.id}`}
          className="flex min-w-0 flex-1 items-center gap-1.5"
          data-testid={`document-node-${doc.id}`}
          aria-label={doc.name}
          aria-current={isActive ? "page" : undefined}
        >
          <FileIcon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
          {!collapsed && <span className="truncate">{doc.name}</span>}
          {!collapsed && doc.meta?.isCanon === true && (
            <span
              className="shrink-0 rounded border border-amber-200 bg-amber-50 px-1 py-0.5 text-[10px] font-semibold leading-none text-amber-700"
              aria-label="Canon"
            >
              C
            </span>
          )}
          {!collapsed && doc.meta?.isCanon === false && (
            <span
              className="shrink-0 rounded border border-indigo-200 bg-indigo-50 px-1 py-0.5 text-[10px] font-semibold leading-none text-indigo-700"
              aria-label="AU variant"
            >
              AU
            </span>
          )}
        </Link>
        {!collapsed && (
          <button
            onClick={(e) => openContextMenu(e, doc.id, "document", doc.name, doc.meta, doc.type)}
            className="invisible shrink-0 rounded p-0.5 text-text-muted hover:bg-border group-hover:visible"
            aria-label={`Options for ${doc.name}`}
            data-testid={`document-menu-${doc.id}`}
          >
            <DotsIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </li>
  );
  };

  const renderDocumentSections = (documents: DocumentItem[], depth: number) =>
    DOCUMENT_TYPE_ORDER.flatMap((type) => {
      const docs = documents
        .filter((d) => d.type === type)
        .sort((a, b) => {
          if (a.order !== null && b.order !== null) return a.order - b.order;
          if (a.order !== null) return -1;
          if (b.order !== null) return 1;
          return 0;
        });
      if (docs.length === 0) return [];

      const sectionLabel = (
        <li key={`section-${type}`}>
          <div
            className="px-2 pb-0.5 pt-2 text-xs font-medium uppercase tracking-wide text-text-muted"
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            {DOCUMENT_SECTION_LABELS[type]}
          </div>
        </li>
      );

      if (type === "SCENE") {
        return [
          sectionLabel,
          <li key={`scene-list-${docs[0]?.id ?? type}`}>
            <ul>
              <SortableSceneList
                docs={docs}
                depth={depth}
                pathname={pathname}
                collapsed={collapsed}
                onContextMenu={(e, id, name, meta, docType) =>
                  openContextMenu(e, id, "document", name, meta, docType)
                }
              />
            </ul>
          </li>,
        ];
      }

      return [sectionLabel, ...docs.map((doc) => renderDocumentNode(doc, depth))];
    });

  const renderStoryNode = (story: StoryItem, depth: number) => {
    const isExpanded = expanded.has(story.id);
    const hasDocuments = story.documents.length > 0;

    return (
      <li key={story.id}>
        <div
          className={`group flex items-center gap-1 rounded px-2 py-1.5 text-sm transition-colors ${
            activeId === story.id
              ? "bg-accent/10 text-accent"
              : "text-text-primary hover:bg-background"
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <button
            onClick={() => toggleExpanded(story.id)}
            className="shrink-0 text-text-muted"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            <ChevronIcon expanded={isExpanded} className="h-3 w-3" />
          </button>
          <button
            onClick={() => setActiveId(story.id)}
            className="flex flex-1 items-center gap-1.5 truncate"
            data-testid={`story-node-${story.id}`}
            aria-label={story.name}
          >
            <BookIcon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
            {!collapsed && <span className="truncate">{story.name}</span>}
          </button>
          {!collapsed && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setNewDocumentModal({ storyId: story.id, storyName: story.name, storyMode: story.mode });
                }}
                className="invisible shrink-0 rounded p-0.5 text-text-muted hover:bg-border group-hover:visible"
                aria-label={`Add document to ${story.name}`}
                data-testid={`story-add-doc-${story.id}`}
              >
                <PlusIcon className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => openContextMenu(e, story.id, "story", story.name)}
                className="invisible shrink-0 rounded p-0.5 text-text-muted hover:bg-border group-hover:visible"
                aria-label={`Options for ${story.name}`}
                data-testid={`story-menu-${story.id}`}
              >
                <DotsIcon className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
        {isExpanded && (
          <ul>
            {hasDocuments && renderDocumentSections(story.documents, depth + 1)}
            <li key={`map-${story.id}`}>
              <div style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}>
                <Link
                  href={`/dashboard/stories/${story.id}/map`}
                  className={`flex items-center gap-1.5 rounded px-2 py-1.5 text-sm transition-colors ${
                    pathname === `/dashboard/stories/${story.id}/map`
                      ? "bg-accent/10 text-accent"
                      : "text-text-muted hover:bg-background hover:text-text-primary"
                  }`}
                  data-testid={`story-map-${story.id}`}
                  aria-label={`Relationship Map for ${story.name}`}
                >
                  <GraphIcon className="h-3.5 w-3.5 shrink-0" />
                  {!collapsed && <span className="truncate">Relationship Map</span>}
                </Link>
              </div>
            </li>
          </ul>
        )}
      </li>
    );
  };

  const renderSeriesNode = (series: SeriesItem, depth: number) => {
    const isExpanded = expanded.has(series.id);
    const hasChildren = series.stories.length > 0;

    return (
      <li key={series.id}>
        <div
          className={`group flex items-center gap-1 rounded px-2 py-1.5 text-sm transition-colors ${
            activeId === series.id
              ? "bg-accent/10 text-accent"
              : "text-text-primary hover:bg-background"
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleExpanded(series.id)}
              className="shrink-0 text-text-muted"
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              <ChevronIcon expanded={isExpanded} className="h-3 w-3" />
            </button>
          ) : (
            <span className="h-3 w-3 shrink-0" />
          )}
          <button
            onClick={() => {
              setActiveId(series.id);
              if (hasChildren) toggleExpanded(series.id);
            }}
            className="flex flex-1 items-center gap-1.5 truncate"
            data-testid={`series-node-${series.id}`}
            aria-label={series.name}
          >
            <LayersIcon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
            {!collapsed && (
              <span className="truncate">{series.name}</span>
            )}
          </button>
          {!collapsed && (
            <button
              onClick={(e) =>
                openContextMenu(e, series.id, "series", series.name)
              }
              className="invisible shrink-0 rounded p-0.5 text-text-muted hover:bg-border group-hover:visible"
              aria-label={`Options for ${series.name}`}
              data-testid={`series-menu-${series.id}`}
            >
              <DotsIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {isExpanded && hasChildren && (
          <ul>
            {series.stories.map((s) => renderStoryNode(s, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  const renderUniverseNode = (universe: UniverseItem) => {
    const isExpanded = expanded.has(universe.id);

    return (
      <li key={universe.id}>
        <div
          className={`group flex items-center gap-1 rounded px-2 py-1.5 text-sm transition-colors ${
            activeId === universe.id
              ? "bg-accent/10 text-accent"
              : "text-text-primary hover:bg-background"
          }`}
        >
          <button
            onClick={() => toggleExpanded(universe.id)}
            className="shrink-0 text-text-muted"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            <ChevronIcon expanded={isExpanded} className="h-3 w-3" />
          </button>
          <button
            onClick={() => {
              setActiveId(universe.id);
              toggleExpanded(universe.id);
            }}
            className="flex flex-1 items-center gap-1.5 truncate"
            data-testid={`universe-node-${universe.id}`}
            aria-label={universe.name}
          >
            <GlobeIcon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
            {!collapsed && (
              <span className="truncate font-medium">{universe.name}</span>
            )}
          </button>
          {!collapsed && (
            <button
              onClick={(e) =>
                openContextMenu(e, universe.id, "universe", universe.name)
              }
              className="invisible shrink-0 rounded p-0.5 text-text-muted hover:bg-border group-hover:visible"
              aria-label={`Options for ${universe.name}`}
              data-testid={`universe-menu-${universe.id}`}
            >
              <DotsIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {isExpanded && (
          <ul>
            {universe.documents.length > 0 && renderDocumentSections(universe.documents, 1)}
            {universe.series.map((s) => renderSeriesNode(s, 1))}
            {universe.stories.map((s) => renderStoryNode(s, 1))}
            <li key={`map-${universe.id}`}>
              <div style={{ paddingLeft: "20px" }}>
                <Link
                  href={`/dashboard/universes/${universe.id}/map`}
                  className={`flex items-center gap-1.5 rounded px-2 py-1.5 text-sm transition-colors ${
                    pathname === `/dashboard/universes/${universe.id}/map`
                      ? "bg-accent/10 text-accent"
                      : "text-text-muted hover:bg-background hover:text-text-primary"
                  }`}
                  data-testid={`universe-map-${universe.id}`}
                  aria-label={`Relationship Map for ${universe.name}`}
                >
                  <GraphIcon className="h-3.5 w-3.5 shrink-0" />
                  {!collapsed && <span className="truncate">Relationship Map</span>}
                </Link>
              </div>
            </li>
          </ul>
        )}
      </li>
    );
  };

  // ── Sidebar content ────────────────────────────────────────────────────────

  const isEmpty =
    tree !== null &&
    tree.universes.length === 0 &&
    tree.standaloneSeries.length === 0 &&
    tree.standaloneStories.length === 0;

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-3">
        {!collapsed && (
          <span className="font-heading text-base font-bold text-text-primary">
            Writing Buddy
          </span>
        )}
        <button
          onClick={toggleCollapsed}
          className={`shrink-0 rounded p-1.5 text-text-muted hover:bg-background ${collapsed ? "mx-auto" : ""}`}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          data-testid="sidebar-collapse-btn"
        >
          <CollapseIcon collapsed={collapsed} className="h-4 w-4" />
        </button>
      </div>

      {/* New Project button */}
      <div className="border-b border-border p-2">
        <button
          onClick={() => setNewProjectModal(true)}
          className={`flex w-full items-center gap-2 rounded px-2 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/10 ${collapsed ? "justify-center" : ""}`}
          aria-label="New project"
          data-testid="new-project-btn"
        >
          <PlusIcon className="h-4 w-4 shrink-0" />
          {!collapsed && <span>New Project</span>}
        </button>
      </div>

      {/* Tree */}
      <nav
        className="flex-1 overflow-y-auto p-2"
        aria-label="Project tree"
        data-testid="project-tree"
      >
        {tree === null ? (
          <div className="space-y-1.5 p-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-4 animate-pulse rounded bg-border"
                style={{ width: `${60 + i * 10}%` }}
              />
            ))}
          </div>
        ) : isEmpty ? (
          !collapsed && (
            <p className="px-2 py-4 text-xs text-text-muted">
              No projects yet. Click &ldquo;New Project&rdquo; to get started.
            </p>
          )
        ) : (
          <ul className="space-y-0.5">
            {tree.universes.map(renderUniverseNode)}
            {tree.standaloneSeries.map((s) => renderSeriesNode(s, 0))}
            {tree.standaloneStories.map((s) => renderStoryNode(s, 0))}
          </ul>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-2">
        <Link
          href={{ pathname: "/dashboard/brainstorm" }}
          className={`flex items-center gap-2 rounded px-2 py-2 text-sm text-text-muted transition-colors hover:bg-background hover:text-text-primary ${collapsed ? "justify-center" : ""}`}
          aria-label="Brainstorm"
          data-testid="brainstorm-link"
        >
          <BrainstormIcon className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Brainstorm</span>}
        </Link>
        <Link
          href={{ pathname: "/dashboard/prompts" }}
          className={`flex items-center gap-2 rounded px-2 py-2 text-sm text-text-muted transition-colors hover:bg-background hover:text-text-primary ${collapsed ? "justify-center" : ""}`}
          aria-label="Saved Prompts"
          data-testid="prompts-link"
        >
          <PromptsIcon className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Saved Prompts</span>}
        </Link>
        <Link
          href="/settings"
          className={`flex items-center gap-2 rounded px-2 py-2 text-sm text-text-muted transition-colors hover:bg-background hover:text-text-primary ${collapsed ? "justify-center" : ""}`}
          aria-label="Settings"
        >
          <SettingsIcon className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop / tablet sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r border-border bg-surface transition-all duration-200 ${collapsed ? "w-14" : "w-64"}`}
        data-testid="sidebar"
        data-collapsed={collapsed ? "true" : "false"}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden" data-testid="mobile-sidebar">
          <aside className="flex w-64 flex-col border-r border-border bg-surface">
            {sidebarContent}
          </aside>
          <button
            className="flex-1 bg-black/40"
            onClick={onMobileClose}
            aria-label="Close sidebar"
          />
        </div>
      )}

      {/* Context menu */}
      {contextMenu !== null && (
        <ContextMenuDropdown
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onRename={() => {
            setRenameModal({
              id: contextMenu.id,
              type: contextMenu.type,
              name: contextMenu.name,
            });
            setContextMenu(null);
          }}
          onDelete={() => {
            setDeleteModal({
              id: contextMenu.id,
              type: contextMenu.type,
              name: contextMenu.name,
            });
            setContextMenu(null);
          }}
          onImportCanon={
            contextMenu.type === "universe"
              ? () => {
                  setCanonIngestionModal({
                    universeId: contextMenu.id,
                    universeName: contextMenu.name,
                  });
                  setContextMenu(null);
                }
              : undefined
          }
          onDuplicateAsAu={
            contextMenu.type === "document" &&
            (contextMenu.docType === "CHARACTER" || contextMenu.docType === "WORLDBUILDING") &&
            contextMenu.meta?.isCanon === true
              ? () => void handleDuplicateAsAu()
              : undefined
          }
          onCheckContradictions={
            contextMenu.type === "story"
              ? () => {
                  setContradictionModal({ storyId: contextMenu.id, storyName: contextMenu.name });
                  setContextMenu(null);
                }
              : undefined
          }
        />
      )}

      {/* Rename modal */}
      {renameModal !== null && (
        <RenameModal
          modal={renameModal}
          onConfirm={handleRename}
          onClose={() => setRenameModal(null)}
        />
      )}

      {/* Delete modal */}
      {deleteModal !== null && (
        <DeleteModal
          modal={deleteModal}
          onConfirm={handleDelete}
          onClose={() => setDeleteModal(null)}
        />
      )}

      {/* New project modal */}
      {newProjectModal && tree !== null && (
        <NewProjectModal
          tree={tree}
          onConfirm={handleCreate}
          onClose={() => setNewProjectModal(false)}
        />
      )}

      {/* New document modal */}
      {newDocumentModal !== null && (
        <NewDocumentModal
          storyId={newDocumentModal.storyId}
          storyName={newDocumentModal.storyName}
          storyMode={newDocumentModal.storyMode}
          onConfirm={(type, name, sourceText) =>
            void handleDocumentCreate(newDocumentModal.storyId, type, name, sourceText)
          }
          onClose={() => setNewDocumentModal(null)}
        />
      )}

      {/* Canon ingestion modal */}
      {canonIngestionModal !== null && (
        <CanonIngestionModal
          universeId={canonIngestionModal.universeId}
          universeName={canonIngestionModal.universeName}
          onClose={() => setCanonIngestionModal(null)}
          onDocumentsCreated={fetchTree}
        />
      )}

      {/* Contradiction checker modal */}
      {contradictionModal !== null && (
        <ContradictionCheckerModal
          storyId={contradictionModal.storyId}
          storyName={contradictionModal.storyName}
          onClose={() => setContradictionModal(null)}
        />
      )}
    </>
  );
}
