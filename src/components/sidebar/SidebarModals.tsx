"use client";

import { useEffect, useRef, useState } from "react";
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_ORDER,
  type DocumentTypeValue,
} from "@/lib/documents";
import type { NodeType, ProjectTree } from "@/types/project-tree";
import { useAgeGate } from "@/hooks/useAgeGate";
import Modal from "@/components/ui/Modal";

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
    <Modal
      title="Age Confirmation Required"
      onClose={onClose}
      zIndex="z-[60]"
      data-testid="age-gate-modal"
    >
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
    </Modal>
  );
}

export interface ModalState {
  id: string;
  type: NodeType;
  name: string;
}

export interface CreateData {
  itemType: NodeType;
  name: string;
  mode: string;
  rating: string;
  sourceTitle?: string;
  universeId?: string;
  seriesId?: string;
}

export interface NewDocumentState {
  parentId: string;
  parentName: string;
  parentType: "story" | "universe";
  storyMode?: string;
}

// ── Rename Modal ──────────────────────────────────────────────────────────────

export function RenameModal({
  modal,
  onConfirm,
  onClose,
}: {
  modal: ModalState;
  onConfirm: (name: string) => Promise<void>;
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
    try {
      await onConfirm(trimmed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Rename ${modal.type}`} onClose={onClose}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
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
          onClick={() => void submit()}
          disabled={saving || !value.trim()}
          className="rounded bg-accent px-4 py-2 text-sm text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {saving ? "Saving…" : "Rename"}
        </button>
      </div>
    </Modal>
  );
}

// ── Delete Modal ──────────────────────────────────────────────────────────────

export function DeleteModal({
  modal,
  onConfirm,
  onClose,
}: {
  modal: ModalState;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={`Delete ${modal.type}?`} onClose={onClose}>
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
    </Modal>
  );
}

// ── New Project Modal ─────────────────────────────────────────────────────────

export function NewProjectModal({
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

  const { showAgeGate, confirming, handleRatingClick, handleAgeGateConfirm, closeAgeGate } =
    useAgeGate(setRating);

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
    <Modal title="New Project" onClose={onClose} data-testid="new-project-modal">
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
            onClose={closeAgeGate}
            confirming={confirming}
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
    </Modal>
  );
}

// ── New Document Modal ────────────────────────────────────────────────────────

const UNIVERSE_DOCUMENT_TYPES = DOCUMENT_TYPE_ORDER.filter((t) => t !== "SCENE");

export function NewDocumentModal({
  parentName,
  parentType,
  storyMode,
  onConfirm,
  onClose,
}: {
  parentName: string;
  parentType: "story" | "universe";
  storyMode?: string;
  onConfirm: (type: DocumentTypeValue, name: string, sourceText?: string) => void;
  onClose: () => void;
}) {
  const allowedTypes = parentType === "universe" ? UNIVERSE_DOCUMENT_TYPES : DOCUMENT_TYPE_ORDER;
  const [docType, setDocType] = useState<DocumentTypeValue>("CHARACTER");
  const [name, setName] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [saving, setSaving] = useState(false);

  const showSourceText = storyMode === "FANFIC" && docType === "CHARACTER";

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    onConfirm(
      docType,
      trimmed,
      showSourceText && sourceText.trim() ? sourceText.trim() : undefined,
    );
  };

  return (
    <Modal onClose={onClose} data-testid="new-document-modal">
      <h2 className="mb-1 font-heading text-lg font-semibold text-text-primary">
        New Document
      </h2>
      <p className="mb-4 text-xs text-text-muted">In: {parentName}</p>

        <fieldset className="mb-4">
          <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-text-muted">
            Type
          </legend>
          <div className="grid grid-cols-3 gap-1.5">
            {allowedTypes.map((type) => (
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
    </Modal>
  );
}
