"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProjectTree } from "@/types/project-tree";

interface SavedPrompt {
  id: string;
  content: string;
  mode: "ORIGINAL" | "FANFIC";
  sourceTitle: string | null;
  convertedToStoryId: string | null;
  createdAt: string;
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <path d="M8 2v12M2 8h12" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <path d="M11 2l3 3-8 8H3v-3l8-8z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10" />
    </svg>
  );
}

function ConvertIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <path d="M2 8h10M9 5l3 3-3 3" />
      <rect x="2" y="2" width="5" height="12" rx="1" />
    </svg>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ── Convert to Story Modal ─────────────────────────────────────────────────────

function ConvertModal({
  prompt,
  onConfirm,
  onClose,
}: {
  prompt: SavedPrompt;
  onConfirm: (data: { name: string; rating: string; seriesId: string; universeId: string }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [rating, setRating] = useState("G");
  const [universeId, setUniverseId] = useState("");
  const [seriesId, setSeriesId] = useState("");
  const [tree, setTree] = useState<ProjectTree | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/project-tree")
      .then((r) => r.json())
      .then((data: ProjectTree) => setTree(data))
      .catch(() => null);
  }, []);

  const allSeries = tree
    ? [...tree.universes.flatMap((u) => u.series), ...tree.standaloneSeries]
    : [];

  const submit = () => {
    if (!name.trim()) return;
    setSaving(true);
    onConfirm({ name: name.trim(), rating, seriesId, universeId });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="convert-modal"
      >
        <h2 className="mb-1 font-heading text-lg font-semibold text-text-primary">
          Convert to Story
        </h2>
        <p className="mb-4 text-sm text-text-muted line-clamp-2">{prompt.content}</p>

        {/* Name */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-muted">
            Story name
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
            placeholder="Untitled Story"
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Rating */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-muted">
            Rating
          </label>
          <div className="flex gap-2">
            {(["G", "T", "M", "E"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRating(r)}
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

        {/* Universe (optional) */}
        {tree !== null && tree.universes.length > 0 && (
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

        {/* Series (optional) */}
        {tree !== null && allSeries.length > 0 && (
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
            className="rounded bg-accent px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create Story"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Prompt Row ─────────────────────────────────────────────────────────────────

function PromptRow({
  prompt,
  onDelete,
  onEdit,
  onConvert,
}: {
  prompt: SavedPrompt;
  onDelete: (id: string) => void;
  onEdit: (id: string, content: string, sourceTitle: string) => void;
  onConvert: (prompt: SavedPrompt) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(prompt.content);
  const [editSourceTitle, setEditSourceTitle] = useState(prompt.sourceTitle ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!editContent.trim()) return;
    setSaving(true);
    await onEdit(prompt.id, editContent.trim(), editSourceTitle.trim());
    setEditing(false);
    setSaving(false);
  };

  return (
    <li
      className="rounded-xl border border-border bg-surface p-4 shadow-sm"
      data-testid="prompt-row"
    >
      {editing ? (
        <div className="space-y-3">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={3}
            className="w-full resize-none rounded border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
            aria-label="Edit prompt content"
          />
          {prompt.mode === "FANFIC" && (
            <input
              type="text"
              value={editSourceTitle}
              onChange={(e) => setEditSourceTitle(e.target.value)}
              placeholder="Source title"
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
              aria-label="Edit source title"
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !editContent.trim()}
              className="rounded bg-accent px-3 py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setEditContent(prompt.content);
                setEditSourceTitle(prompt.sourceTitle ?? "");
              }}
              className="rounded border border-border px-3 py-1.5 text-xs text-text-muted hover:bg-background"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-text-primary">{prompt.content}</p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-background px-2 py-0.5 text-xs text-text-muted">
              {prompt.mode === "FANFIC" ? "Fanfic" : "Original"}
            </span>
            {prompt.sourceTitle !== null && (
              <span className="text-xs text-text-muted">· {prompt.sourceTitle}</span>
            )}
            <span className="text-xs text-text-muted">· {formatDate(prompt.createdAt)}</span>
            {prompt.convertedToStoryId !== null && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                Converted
              </span>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => onConvert(prompt)}
              disabled={prompt.convertedToStoryId !== null}
              data-testid="convert-btn"
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:bg-background hover:text-accent disabled:opacity-40"
            >
              <ConvertIcon />
              Convert to Story
            </button>
            <button
              onClick={() => setEditing(true)}
              aria-label="Edit prompt"
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:bg-background"
            >
              <EditIcon />
              Edit
            </button>
            <button
              onClick={() => onDelete(prompt.id)}
              aria-label="Delete prompt"
              className="ml-auto flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-text-muted transition-colors hover:bg-background hover:text-red-500"
            >
              <TrashIcon />
              Delete
            </button>
          </div>
        </>
      )}
    </li>
  );
}

// ── Add Prompt Form ────────────────────────────────────────────────────────────

function AddPromptForm({
  onAdd,
  onCancel,
}: {
  onAdd: (content: string, mode: "ORIGINAL" | "FANFIC", sourceTitle: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<"ORIGINAL" | "FANFIC">("ORIGINAL");
  const [sourceTitle, setSourceTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSaving(true);
    await onAdd(content.trim(), mode, sourceTitle.trim());
    setSaving(false);
  };

  return (
    <div className="rounded-xl border border-accent/40 bg-surface p-4 shadow-sm">
      <div className="mb-3 flex gap-2">
        {(["ORIGINAL", "FANFIC"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              mode === m
                ? "bg-accent text-white"
                : "border border-border text-text-muted hover:bg-background"
            }`}
            aria-pressed={mode === m}
          >
            {m === "ORIGINAL" ? "Original" : "Fanfic"}
          </button>
        ))}
      </div>

      {mode === "FANFIC" && (
        <input
          type="text"
          value={sourceTitle}
          onChange={(e) => setSourceTitle(e.target.value)}
          placeholder="Source title (optional)"
          className="mb-3 w-full rounded border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
        />
      )}

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        autoFocus
        placeholder="Enter your story logline or prompt…"
        className="mb-3 w-full resize-none rounded border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
        aria-label="Prompt content"
      />

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={saving || !content.trim()}
          className="rounded bg-accent px-4 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Add Prompt"}
        </button>
        <button
          onClick={onCancel}
          className="rounded border border-border px-4 py-1.5 text-sm text-text-muted hover:bg-background"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PromptsPage() {
  const router = useRouter();
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [convertTarget, setConvertTarget] = useState<SavedPrompt | null>(null);

  const fetchPrompts = useCallback(async () => {
    const res = await fetch("/api/saved-prompts");
    if (res.ok) {
      const data = (await res.json()) as SavedPrompt[];
      setPrompts(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  const handleAdd = async (
    content: string,
    mode: "ORIGINAL" | "FANFIC",
    sourceTitle: string,
  ) => {
    const res = await fetch("/api/saved-prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, mode, sourceTitle: sourceTitle || undefined }),
    });
    if (res.ok) {
      setShowAddForm(false);
      await fetchPrompts();
    }
  };

  const handleEdit = async (id: string, content: string, sourceTitle: string) => {
    const res = await fetch(`/api/saved-prompts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, sourceTitle: sourceTitle || undefined }),
    });
    if (res.ok) {
      await fetchPrompts();
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/saved-prompts/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPrompts((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleConvert = async (data: {
    name: string;
    rating: string;
    seriesId: string;
    universeId: string;
  }) => {
    if (!convertTarget) return;
    const res = await fetch(`/api/saved-prompts/${convertTarget.id}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const result = (await res.json()) as { id: string; plotDocumentId: string };
      setConvertTarget(null);
      router.push(`/dashboard/documents/${result.plotDocumentId}`);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-8">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-text-primary">Saved Prompts</h1>
          <p className="mt-1 text-text-muted">Your library of story loglines and ideas.</p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            data-testid="add-prompt-btn"
          >
            <PlusIcon />
            Add Prompt
          </button>
        )}
      </header>

      {showAddForm && (
        <div className="mb-6">
          <AddPromptForm
            onAdd={handleAdd}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}

      {loading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : prompts.length === 0 && !showAddForm ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-text-muted">No saved prompts yet.</p>
          <p className="mt-1 text-sm text-text-muted">
            Generate loglines on the{" "}
            <a href="/dashboard/brainstorm" className="text-accent underline">
              Brainstorm
            </a>{" "}
            page, or add a prompt manually.
          </p>
        </div>
      ) : (
        <ul className="space-y-4" data-testid="prompt-list">
          {prompts.map((prompt) => (
            <PromptRow
              key={prompt.id}
              prompt={prompt}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onConvert={setConvertTarget}
            />
          ))}
        </ul>
      )}

      {convertTarget !== null && (
        <ConvertModal
          prompt={convertTarget}
          onConfirm={handleConvert}
          onClose={() => setConvertTarget(null)}
        />
      )}
    </div>
  );
}
