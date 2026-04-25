"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type {
  NodeType,
  ProjectTree,
  SeriesItem,
  StoryItem,
  UniverseItem,
} from "@/types/project-tree";

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

// ── Types ─────────────────────────────────────────────────────────────────────

interface ContextMenuState {
  id: string;
  type: NodeType;
  name: string;
  x: number;
  y: number;
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
  universeId?: string;
  seriesId?: string;
}

// ── Context Menu ──────────────────────────────────────────────────────────────

function ContextMenuDropdown({
  menu,
  onRename,
  onDelete,
  onClose,
}: {
  menu: ContextMenuState;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
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

  return (
    <div
      ref={ref}
      role="menu"
      data-testid="context-menu"
      className="fixed z-50 min-w-[120px] rounded border border-border bg-surface py-1 shadow-lg"
      style={{ top: menu.y, left: menu.x }}
    >
      <button
        role="menuitem"
        className="block w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-background"
        onClick={onRename}
      >
        Rename
      </button>
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
          &ldquo;{modal.name}&rdquo; will be permanently deleted. Children
          (series, stories) will be orphaned, not deleted.
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
  const [universeId, setUniverseId] = useState("");
  const [seriesId, setSeriesId] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    onConfirm({
      itemType,
      name: trimmed,
      mode,
      rating,
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

        {/* Rating */}
        <div className="mb-6">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-muted">
            Rating
          </label>
          <div className="flex gap-2">
            {["G", "T", "M", "E"].map((r) => (
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

// ── Sidebar ───────────────────────────────────────────────────────────────────

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const [tree, setTree] = useState<ProjectTree | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renameModal, setRenameModal] = useState<ModalState | null>(null);
  const [deleteModal, setDeleteModal] = useState<ModalState | null>(null);
  const [newProjectModal, setNewProjectModal] = useState(false);

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
  ) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setContextMenu({ id, type, name, x: rect.right + 4, y: rect.top });
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

  const handleCreate = async (data: CreateData) => {
    const endpoint = `/api/${data.itemType}s`;
    const body: Record<string, unknown> = {
      name: data.name,
      mode: data.mode,
      rating: data.rating,
    };
    if (data.itemType === "series" && data.universeId) {
      body.universeId = data.universeId;
    }
    if (data.itemType === "story") {
      if (data.universeId) body.universeId = data.universeId;
      if (data.seriesId) body.seriesId = data.seriesId;
    }
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setNewProjectModal(false);
    fetchTree();
  };

  // ── Tree node renderers ────────────────────────────────────────────────────

  const renderStoryNode = (story: StoryItem, depth: number) => (
    <li key={story.id}>
      <div
        className={`group flex items-center gap-1.5 rounded px-2 py-1.5 text-sm transition-colors ${
          activeId === story.id
            ? "bg-accent/10 text-accent"
            : "text-text-primary hover:bg-background"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <button
          onClick={() => setActiveId(story.id)}
          className="flex flex-1 items-center gap-1.5 truncate"
          data-testid={`story-node-${story.id}`}
          aria-label={story.name}
        >
          <BookIcon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
          {!collapsed && (
            <span className="truncate">{story.name}</span>
          )}
        </button>
        {!collapsed && (
          <button
            onClick={(e) => openContextMenu(e, story.id, "story", story.name)}
            className="invisible shrink-0 rounded p-0.5 text-text-muted hover:bg-border group-hover:visible"
            aria-label={`Options for ${story.name}`}
            data-testid={`story-menu-${story.id}`}
          >
            <DotsIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </li>
  );

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
    const hasChildren = universe.series.length > 0 || universe.stories.length > 0;

    return (
      <li key={universe.id}>
        <div
          className={`group flex items-center gap-1 rounded px-2 py-1.5 text-sm transition-colors ${
            activeId === universe.id
              ? "bg-accent/10 text-accent"
              : "text-text-primary hover:bg-background"
          }`}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleExpanded(universe.id)}
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
              setActiveId(universe.id);
              if (hasChildren) toggleExpanded(universe.id);
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
        {isExpanded && hasChildren && (
          <ul>
            {universe.series.map((s) => renderSeriesNode(s, 1))}
            {universe.stories.map((s) => renderStoryNode(s, 1))}
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
    </>
  );
}
