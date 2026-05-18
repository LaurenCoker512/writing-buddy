"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
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
import { calculateInsertOrder } from "@/lib/scene-order";
import { isSceneMeta, isPlotMeta } from "@/lib/document-meta";
import { GripIcon } from "@/components/icons";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SceneRow {
  id: string;
  name: string;
  order: number | null;
  plotSummary: string;
}

interface StoryRow {
  id: string;
  name: string;
  summary: string;
}

// ── Scene Board (story-scoped Plot) ───────────────────────────────────────────

function SortableSceneRow({
  row,
  onSummaryChange,
}: {
  row: SceneRow;
  onSummaryChange: (id: string, value: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: row.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const [draft, setDraft] = useState(row.plotSummary);

  useEffect(() => {
    setDraft(row.plotSummary);
  }, [row.plotSummary]);

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="group flex items-start gap-2 rounded border border-border bg-surface px-3 py-2"
    >
      <button
        {...listeners}
        className="mt-0.5 shrink-0 cursor-grab text-text-muted opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        aria-label={`Drag to reorder ${row.name}`}
        tabIndex={-1}
      >
        <GripIcon className="h-3.5 w-3.5" />
      </button>
      <div className="min-w-0 flex-1">
        <Link
          href={`/dashboard/documents/${row.id}`}
          className="block truncate text-sm font-medium text-text-primary hover:text-accent"
        >
          {row.name}
        </Link>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => onSummaryChange(row.id, draft)}
          placeholder="Add a brief plot summary for this scene…"
          className="mt-0.5 w-full bg-transparent text-xs text-text-muted outline-none placeholder:text-text-muted/40 focus:text-text-primary"
          aria-label={`Plot summary for ${row.name}`}
        />
      </div>
    </li>
  );
}

interface SceneBoardProps {
  storyId: string;
  plotDocId: string;
}

function SceneBoard({ storyId, plotDocId: _plotDocId }: SceneBoardProps) {
  const [rows, setRows] = useState<SceneRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScenes = useCallback(async () => {
    const res = await fetch(`/api/documents?storyId=${storyId}&types=SCENE`);
    if (!res.ok) return;
    const docs = (await res.json()) as {
      id: string;
      name: string;
      order: number | null;
      meta: unknown;
    }[];
    const sorted = [...docs].sort((a, b) => {
      if (a.order !== null && b.order !== null) return a.order - b.order;
      if (a.order !== null) return -1;
      if (b.order !== null) return 1;
      return 0;
    });
    setRows(
      sorted.map((d) => ({
        id: d.id,
        name: d.name,
        order: d.order,
        plotSummary: isSceneMeta(d.meta) ? (d.meta.plotSummary ?? "") : "",
      })),
    );
    setLoading(false);
  }, [storyId]);

  useEffect(() => {
    void fetchScenes();
  }, [fetchScenes]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = rows.findIndex((r) => r.id === active.id);
    const newIndex = rows.findIndex((r) => r.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(rows, oldIndex, newIndex);
    const otherOrders = reordered.filter((r) => r.id !== active.id).map((r) => r.order);
    const newOrder = calculateInsertOrder(otherOrders, newIndex);

    setRows(reordered.map((r) => (r.id === active.id ? { ...r, order: newOrder } : r)));

    void fetch(`/api/documents/${String(active.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: newOrder }),
    }).then(() => {
      window.dispatchEvent(new Event("writing-buddy:tree-refresh"));
    });
  }

  const handleSummaryChange = (id: string, value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, plotSummary: value } : r)));
    void fetch(`/api/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meta: { plotSummary: value } }),
    });
  };

  if (loading) {
    return <p className="text-xs text-text-muted">Loading scenes…</p>;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-1.5">
          {rows.map((row) => (
            <SortableSceneRow key={row.id} row={row} onSummaryChange={handleSummaryChange} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

// ── Story Board (series-scoped Plot) ──────────────────────────────────────────

interface StoryBoardProps {
  seriesId: string;
  plotDocId: string;
  initialMeta: unknown;
}

function StoryBoard({ seriesId, plotDocId, initialMeta }: StoryBoardProps) {
  const [rows, setRows] = useState<StoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const summariesRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (isPlotMeta(initialMeta) && initialMeta.storySummaries) {
      summariesRef.current = { ...initialMeta.storySummaries };
    }
  }, [initialMeta]);

  useEffect(() => {
    const fetchStories = async () => {
      const res = await fetch(`/api/project-tree`);
      if (!res.ok) return;
      const tree = (await res.json()) as {
        standaloneSeries: { id: string; stories: { id: string; name: string }[] }[];
        universes: {
          series: { id: string; stories: { id: string; name: string }[] }[];
        }[];
      };

      let stories: { id: string; name: string }[] = [];
      for (const s of tree.standaloneSeries) {
        if (s.id === seriesId) { stories = s.stories; break; }
      }
      if (stories.length === 0) {
        for (const u of tree.universes) {
          for (const s of u.series) {
            if (s.id === seriesId) { stories = s.stories; break; }
          }
        }
      }

      const summaries = summariesRef.current;
      setRows(
        stories.map((s) => ({
          id: s.id,
          name: s.name,
          summary: summaries[s.id] ?? "",
        })),
      );
      setLoading(false);
    };
    void fetchStories();
  }, [seriesId]);

  const handleSummaryChange = (storyId: string, value: string) => {
    setRows((prev) => prev.map((r) => (r.id === storyId ? { ...r, summary: value } : r)));
    const updatedSummaries = { ...summariesRef.current, [storyId]: value };
    summariesRef.current = updatedSummaries;
    void fetch(`/api/documents/${plotDocId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meta: { storySummaries: updatedSummaries } }),
    });
  };

  if (loading) {
    return <p className="text-xs text-text-muted">Loading stories…</p>;
  }

  if (rows.length === 0) {
    return (
      <p className="text-xs text-text-muted">
        No stories in this series yet. Add stories through the sidebar.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <StoryRow key={row.id} row={row} onSummaryChange={handleSummaryChange} />
      ))}
    </ul>
  );
}

function StoryRow({
  row,
  onSummaryChange,
}: {
  row: StoryRow;
  onSummaryChange: (id: string, value: string) => void;
}) {
  const [draft, setDraft] = useState(row.summary);

  useEffect(() => {
    setDraft(row.summary);
  }, [row.summary]);

  return (
    <li className="flex items-start gap-2 rounded border border-border bg-surface px-3 py-2">
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-text-primary">{row.name}</span>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => onSummaryChange(row.id, draft)}
          placeholder="Add a brief summary for this story's role in the series…"
          className="mt-0.5 w-full bg-transparent text-xs text-text-muted outline-none placeholder:text-text-muted/40 focus:text-text-primary"
          aria-label={`Series plot summary for ${row.name}`}
        />
      </div>
    </li>
  );
}

// ── PlotBoard (public entry point) ────────────────────────────────────────────

interface PlotBoardProps {
  variant: "scenes" | "stories";
  plotDocId: string;
  storyId?: string;
  seriesId?: string;
  plotDocMeta?: unknown;
}

export default function PlotBoard({
  variant,
  plotDocId,
  storyId,
  seriesId,
  plotDocMeta,
}: PlotBoardProps) {
  const title = variant === "scenes" ? "Scenes" : "Stories in Series";
  const description =
    variant === "scenes"
      ? "Link each scene to a brief plot summary. Drag to reorder."
      : "Add a summary for each story's role in the overall series arc.";

  return (
    <section className="mt-8 border-t border-border pt-6">
      <div className="mb-3">
        <h2 className="font-heading text-base font-semibold text-text-primary">{title}</h2>
        <p className="text-xs text-text-muted">{description}</p>
      </div>
      {variant === "scenes" && storyId !== undefined ? (
        <SceneBoard storyId={storyId} plotDocId={plotDocId} />
      ) : variant === "stories" && seriesId !== undefined ? (
        <StoryBoard seriesId={seriesId} plotDocId={plotDocId} initialMeta={plotDocMeta} />
      ) : null}
    </section>
  );
}
