"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  SubcategoryItem,
  UniverseItem,
} from "@/types/project-tree";
import {
  DOCUMENT_SECTION_LABELS,
  DOCUMENT_TYPE_ORDER,
} from "@/lib/documents";
import { calculateInsertOrder } from "@/lib/scene-order";
import CanonIngestionModal from "@/components/CanonIngestionModal";
import ContradictionCheckerModal from "@/components/ContradictionCheckerModal";
import {
  RenameModal,
  DeleteModal,
  NewProjectModal,
  NewDocumentModal,
  MoveStoryModal,
  type ModalState,
  type CreateData,
  type NewDocumentState,
  type MoveStoryState,
} from "@/components/sidebar/SidebarModals";
import {
  GlobeIcon,
  LayersIcon,
  BookIcon,
  ChevronIcon,
  DotsIcon,
  PlusIcon,
  CollapseIcon,
  PromptsIcon,
  BrainstormIcon,
  SettingsIcon,
  FileIcon,
  GripIcon,
  GraphIcon,
} from "@/components/icons";
import { useDocumentCreate } from "@/hooks/useDocumentCreate";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ContextMenuState {
  id: string;
  type: NodeType;
  name: string;
  x: number;
  y: number;
  meta?: Record<string, unknown> | null;
  docType?: string;
  subcategoryId?: string | null;
  availableSubcategories?: SubcategoryItem[];
}

type NewSubcategoryState = {
  parentId: string;
  parentType: "story" | "series" | "universe";
  documentType: string;
  value: string;
};

interface CanonIngestionState {
  universeId: string;
  universeName: string;
}

// ── Context Menu ──────────────────────────────────────────────────────────────

function ContextMenuDropdown({
  menu,
  onRename,
  onDelete,
  onClose,
  onImportCanon,
  onCheckContradictions,
  onSetSubcategory,
  onMove,
}: {
  menu: ContextMenuState;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
  onImportCanon?: () => void;
  onCheckContradictions?: () => void;
  onSetSubcategory?: (subcategoryId: string | null) => void;
  onMove?: () => void;
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
      {menu.docType !== "PLOT" && (
        <button role="menuitem" className={menuItemClass} onClick={onRename}>
          Rename
        </button>
      )}
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
      {menu.type === "story" && onMove !== undefined && (
        <button role="menuitem" className={menuItemClass} onClick={onMove}>
          Move to…
        </button>
      )}
      {menu.type === "document" && (
        <>
          {(menu.docType === "CHARACTER" || menu.docType === "WORLDBUILDING" || menu.docType === "SCENE") &&
            onSetSubcategory !== undefined &&
            menu.availableSubcategories !== undefined && (
              <div className="border-t border-border py-1">
                <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  Subcategory
                </p>
                <button
                  role="menuitem"
                  className={`${menuItemClass} ${menu.subcategoryId === null || menu.subcategoryId === undefined ? "font-semibold" : ""}`}
                  onClick={() => { onSetSubcategory(null); onClose(); }}
                >
                  None
                </button>
                {menu.availableSubcategories.map((sub) => (
                  <button
                    key={sub.id}
                    role="menuitem"
                    className={`${menuItemClass} ${menu.subcategoryId === sub.id ? "font-semibold" : ""}`}
                    onClick={() => { onSetSubcategory(sub.id); onClose(); }}
                  >
                    {sub.name}
                  </button>
                ))}
              </div>
            )}
          {/* TODO: AU vs Canon feature — expand into a full workflow before re-enabling.
               "Duplicate as AU" context menu item hidden until the feature is complete.
          {(menu.docType === "CHARACTER" || menu.docType === "WORLDBUILDING") &&
            menu.meta?.isCanon === true &&
            onDuplicateAsAu !== undefined && (
              <button role="menuitem" className={menuItemClass} onClick={onDuplicateAsAu}>
                Duplicate as AU
              </button>
            )} */}
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
      {menu.docType !== "PLOT" && (
        <button
          role="menuitem"
          className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-background"
          onClick={onDelete}
        >
          Delete
        </button>
      )}
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
            className="opacity-0 shrink-0 rounded p-0.5 text-text-muted hover:bg-border group-hover:opacity-100 focus:opacity-100"
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
  availableSubcategories,
  onContextMenu,
}: {
  docs: DocumentItem[];
  depth: number;
  pathname: string;
  collapsed: boolean;
  availableSubcategories: SubcategoryItem[];
  onContextMenu: (
    e: React.MouseEvent,
    id: string,
    name: string,
    meta?: Record<string, unknown> | null,
    docType?: string,
    subcategoryId?: string | null,
    availableSubcategories?: SubcategoryItem[],
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
            onContextMenu={(e) =>
              onContextMenu(e, doc.id, doc.name, doc.meta, doc.type, doc.subcategoryId, availableSubcategories)
            }
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
  const [moveStoryModal, setMoveStoryModal] = useState<MoveStoryState | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [newSubcategoryState, setNewSubcategoryState] = useState<NewSubcategoryState | null>(null);

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
    void fetchTree();
  }, [fetchTree]);

  useEffect(() => {
    const handler = () => void fetchTree();
    window.addEventListener("writing-buddy:tree-refresh", handler);
    return () => window.removeEventListener("writing-buddy:tree-refresh", handler);
  }, [fetchTree]);

  const { createDocument } = useDocumentCreate({
    onComplete: () => setNewDocumentModal(null),
    onTreeRefresh: () => void fetchTree(),
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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
    subcategoryId?: string | null,
    availableSubcategories?: SubcategoryItem[],
  ) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setContextMenu({ id, type, name, x: rect.right + 4, y: rect.top, meta, docType, subcategoryId, availableSubcategories });
  };

  const handleSetSubcategory = async (docId: string, subcategoryId: string | null) => {
    await fetch(`/api/documents/${docId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subcategoryId }),
    });
    setContextMenu(null);
    void fetchTree();
  };

  const handleCreateSubcategory = async () => {
    if (!newSubcategoryState) return;
    const name = newSubcategoryState.value.trim();
    setNewSubcategoryState(null);
    if (!name) return;
    await fetch("/api/subcategories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        documentType: newSubcategoryState.documentType,
        [`${newSubcategoryState.parentType}Id`]: newSubcategoryState.parentId,
      }),
    });
    void fetchTree();
  };

  const NODE_API: Record<NodeType, string> = {
    universe: "/api/universes",
    series: "/api/series",
    story: "/api/stories",
    document: "/api/documents",
    subcategory: "/api/subcategories",
  };

  const handleRename = async (name: string) => {
    if (!renameModal) return;
    await fetch(`${NODE_API[renameModal.type]}/${renameModal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setRenameModal(null);
    void fetchTree();
    // Refresh server-component data so page headers (e.g. the document <h1>)
    // reflect the new name without a full navigation.
    router.refresh();
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    await fetch(`${NODE_API[deleteModal.type]}/${deleteModal.id}`, {
      method: "DELETE",
    });

    // Navigate away before tearing down state, so the deleted page isn't left
    // open as a 404 if the user was viewing it.
    const shouldRedirect =
      deleteModal.type === "document" &&
      pathname === `/dashboard/documents/${deleteModal.id}`;

    setDeleteModal(null);
    void fetchTree();

    if (shouldRedirect) {
      router.push("/dashboard");
    }
  };

  const handleMoveStory = async (seriesId: string | null, universeId: string | null) => {
    if (!moveStoryModal) return;
    await fetch(`/api/stories/${moveStoryModal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seriesId, universeId }),
    });
    setMoveStoryModal(null);
    void fetchTree();
  };

  const handleCreate = async (data: CreateData) => {
    const endpoint = NODE_API[data.itemType];
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
    void fetchTree();
    if (!res.ok) return;
    const created = (await res.json()) as { id: string };
    if (data.itemType === "universe" && data.mode === "FANFIC") {
      setCanonIngestionModal({ universeId: created.id, universeName: data.name });
    } else if (data.itemType === "story") {
      setExpanded((prev) => new Set([...prev, created.id]));
      router.push(`/dashboard/stories/${created.id}/map`);
    }
  };

  // ── Tree node renderers ────────────────────────────────────────────────────

  const renderDocumentNode = (doc: DocumentItem, depth: number, availableSubcategories?: SubcategoryItem[]) => {
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
          {doc.type === "BRAINSTORM" ? (
            <BrainstormIcon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
          ) : (
            <FileIcon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
          )}
          {!collapsed && <span className="truncate">{doc.name}</span>}
          {/* TODO: AU vs Canon feature — expand into a full workflow before re-enabling.
               Sidebar Canon ("C") and AU badges hidden until the feature is complete.
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
          )} */}
        </Link>
        {!collapsed && (
          <button
            onClick={(e) =>
              openContextMenu(e, doc.id, "document", doc.name, doc.meta, doc.type, doc.subcategoryId, availableSubcategories)
            }
            className="opacity-0 shrink-0 rounded p-0.5 text-text-muted hover:bg-border group-hover:opacity-100 focus:opacity-100"
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

  const SUBCATEGORY_TYPES = new Set(["CHARACTER", "WORLDBUILDING", "SCENE"]);

  const renderDocumentSections = (
    documents: DocumentItem[],
    depth: number,
    parentId: string,
    parentType: "story" | "series" | "universe",
    subcategories: SubcategoryItem[],
    mapHref?: string,
    mapAriaLabel?: string,
    parentName?: string,
    storyMode?: string,
  ) =>
    DOCUMENT_TYPE_ORDER.flatMap((type) => {
      // Story-scoped SCENE documents are nested under the Plot entry; skip standalone rendering.
      if (type === "SCENE" && parentType === "story") return [];

      // Story-scoped PLOT: render as a special collapsible singleton with Scenes nested beneath.
      if (type === "PLOT" && parentType === "story") {
        const sortedScenes = documents
          .filter((d) => d.type === "SCENE")
          .sort((a, b) => {
            if (a.order !== null && b.order !== null) return a.order - b.order;
            if (a.order !== null) return -1;
            if (b.order !== null) return 1;
            return 0;
          });
        const sceneSubs = subcategories.filter((s) => s.documentType === "SCENE");
        const plotDoc = documents.find((d) => d.type === "PLOT");
        if (!plotDoc) return [];

        const plotScenesKey = `${parentId}-plot-scenes`;
        const areScenesExpanded = !collapsedSections.has(plotScenesKey);
        const isPlotActive = pathname === `/dashboard/documents/${plotDoc.id}`;

        const sceneSection = areScenesExpanded
          ? [
              <li key={`plot-scenes-${parentId}`}>
                <ul>
                  {sceneSubs.length > 0 ? (
                    // Render scenes grouped by subcategory
                    (() => {
                      const subGroups = sceneSubs.flatMap((sub) => {
                        const subDocs = sortedScenes.filter((d) => d.subcategoryId === sub.id);
                        const subKey = `${parentId}-subcat-${sub.id}`;
                        const isSubCollapsed = collapsedSections.has(subKey);
                        const subHeader = (
                          <li key={`subcat-header-${sub.id}`} className="group/subcat">
                            <div className="flex items-center" style={{ paddingLeft: `${(depth + 1) * 12 + 20}px`, paddingRight: "8px" }}>
                              <button
                                onClick={() => toggleSection(subKey)}
                                className="flex flex-1 items-center gap-1 py-0.5 text-xs text-text-muted hover:text-text-primary"
                                aria-expanded={!isSubCollapsed}
                              >
                                {!collapsed && <ChevronIcon expanded={!isSubCollapsed} className="h-2 w-2 shrink-0" />}
                                {!collapsed && <span className="truncate">{sub.name}</span>}
                              </button>
                              {!collapsed && (
                                <button
                                  onClick={(e) => openContextMenu(e, sub.id, "subcategory", sub.name)}
                                  className="invisible shrink-0 rounded p-0.5 text-text-muted hover:bg-border hover:text-text-primary group-hover/subcat:visible"
                                  aria-label={`Options for subcategory ${sub.name}`}
                                >
                                  <DotsIcon className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </li>
                        );
                        if (isSubCollapsed) return [subHeader];
                        return [
                          subHeader,
                          <li key={`subcat-scene-${sub.id}`}>
                            <ul>
                              <SortableSceneList
                                docs={subDocs}
                                depth={depth + 2}
                                pathname={pathname}
                                collapsed={collapsed}
                                availableSubcategories={sceneSubs}
                                onContextMenu={(e, id, name, meta, docType, subcategoryId, avail) =>
                                  openContextMenu(e, id, "document", name, meta, docType, subcategoryId, avail)
                                }
                              />
                            </ul>
                          </li>,
                        ];
                      });
                      const uncategorized = sortedScenes.filter(
                        (d) => !sceneSubs.some((s) => s.id === d.subcategoryId),
                      );
                      return [
                        ...subGroups,
                        ...(uncategorized.length > 0
                          ? [
                              <li key={`uncat-label-${parentId}-SCENE`}>
                                <p
                                  className="pb-0.5 pt-1 text-[10px] uppercase tracking-wide text-text-muted/50"
                                  style={{ paddingLeft: `${(depth + 1) * 12 + 22}px` }}
                                >
                                  {!collapsed && "Uncategorized"}
                                </p>
                              </li>,
                              <li key={`uncat-scene-${parentId}`}>
                                <ul>
                                  <SortableSceneList
                                    docs={uncategorized}
                                    depth={depth + 2}
                                    pathname={pathname}
                                    collapsed={collapsed}
                                    availableSubcategories={sceneSubs}
                                    onContextMenu={(e, id, name, meta, docType, subcategoryId, avail) =>
                                      openContextMenu(e, id, "document", name, meta, docType, subcategoryId, avail)
                                    }
                                  />
                                </ul>
                              </li>,
                            ]
                          : []),
                      ];
                    })()
                  ) : (
                    <SortableSceneList
                      docs={sortedScenes}
                      depth={depth + 1}
                      pathname={pathname}
                      collapsed={collapsed}
                      availableSubcategories={sceneSubs}
                      onContextMenu={(e, id, name, meta, docType, subcategoryId, avail) =>
                        openContextMenu(e, id, "document", name, meta, docType, subcategoryId, avail)
                      }
                    />
                  )}
                </ul>
              </li>,
            ]
          : [];

        return [
          <li key={`plot-entry-${plotDoc.id}`} className="group/plot">
            <div
              className={`flex items-center gap-1 rounded px-2 py-1.5 text-sm transition-colors ${
                isPlotActive ? "bg-accent/10 text-accent" : "text-text-primary hover:bg-background"
              }`}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              <button
                onClick={() => toggleSection(plotScenesKey)}
                className="shrink-0 text-text-muted"
                aria-label={areScenesExpanded ? "Collapse scenes" : "Expand scenes"}
              >
                <ChevronIcon expanded={areScenesExpanded} className="h-3 w-3" />
              </button>
              <Link
                href={`/dashboard/documents/${plotDoc.id}`}
                className="flex flex-1 items-center gap-1.5 truncate"
                data-testid={`document-node-${plotDoc.id}`}
                aria-label="Plot"
                aria-current={isPlotActive ? "page" : undefined}
              >
                <FileIcon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                {!collapsed && <span className="truncate">Plot</span>}
              </Link>
              {!collapsed && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (parentName !== undefined) {
                        setNewDocumentModal({
                          parentId,
                          parentName,
                          parentType: "story",
                          storyMode,
                          forceType: "SCENE",
                        });
                        if (!areScenesExpanded) toggleSection(plotScenesKey);
                      }
                    }}
                    className="opacity-0 shrink-0 rounded p-0.5 text-text-muted hover:bg-border group-hover/plot:opacity-100 focus:opacity-100"
                    aria-label="Add scene"
                    data-testid={`plot-add-scene-${parentId}`}
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) =>
                      openContextMenu(e, plotDoc.id, "document", "Plot", plotDoc.meta, "PLOT")
                    }
                    className="opacity-0 shrink-0 rounded p-0.5 text-text-muted hover:bg-border group-hover/plot:opacity-100 focus:opacity-100"
                    aria-label="Plot options"
                    data-testid={`document-menu-${plotDoc.id}`}
                  >
                    <DotsIcon className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </li>,
          ...sceneSection,
        ];
      }

      const docs = documents
        .filter((d) => d.type === type)
        .sort((a, b) => {
          if (a.order !== null && b.order !== null) return a.order - b.order;
          if (a.order !== null) return -1;
          if (b.order !== null) return 1;
          return 0;
        });

      const isRelationship = type === "RELATIONSHIP";
      const hasMap = isRelationship && mapHref !== undefined;
      const supportsSubcategories = SUBCATEGORY_TYPES.has(type);
      const typeSubs = supportsSubcategories ? subcategories.filter((s) => s.documentType === type) : [];

      // Show new-subcategory inline input for this type if active
      const isCreatingSubcat =
        newSubcategoryState?.parentId === parentId && newSubcategoryState?.documentType === type;

      if (docs.length === 0 && !hasMap && !isCreatingSubcat) return [];

      const sectionKey = `${parentId}-${type}`;
      const isSectionCollapsed = collapsedSections.has(sectionKey);

      const isBrainstormSection = type === "BRAINSTORM";
      const sectionLabel = (
        <li key={`section-${type}`} className="group/section">
          <div className="flex items-center" style={{ paddingRight: "8px" }}>
            <button
              onClick={() => toggleSection(sectionKey)}
              className={`flex flex-1 items-center gap-1 pb-0.5 pt-2 text-xs font-medium uppercase tracking-wide hover:text-text-primary ${isBrainstormSection ? "text-accent/70" : "text-text-muted"}`}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              aria-expanded={!isSectionCollapsed}
            >
              {!collapsed && <ChevronIcon expanded={!isSectionCollapsed} className="h-2.5 w-2.5 shrink-0" />}
              {!collapsed && isBrainstormSection && (
                <BrainstormIcon className="h-3 w-3 shrink-0" />
              )}
              {!collapsed && DOCUMENT_SECTION_LABELS[type]}
            </button>
            {!collapsed && supportsSubcategories && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setNewSubcategoryState({ parentId, parentType, documentType: type, value: "" });
                  if (isSectionCollapsed) toggleSection(sectionKey);
                }}
                className="invisible shrink-0 rounded p-0.5 text-text-muted hover:bg-border hover:text-text-primary group-hover/section:visible"
                aria-label={`Add subcategory for ${DOCUMENT_SECTION_LABELS[type]}`}
              >
                <PlusIcon className="h-3 w-3" />
              </button>
            )}
          </div>
        </li>
      );

      if (isSectionCollapsed) return [sectionLabel];

      // Inline new-subcategory input
      const newSubcatInput = isCreatingSubcat ? (
        <li key={`new-subcat-${parentId}-${type}`}>
          <div style={{ paddingLeft: `${depth * 12 + 20}px`, paddingRight: "8px" }} className="pb-0.5 pt-1">
            <input
              type="text"
              autoFocus
              value={newSubcategoryState!.value}
              onChange={(e) =>
                setNewSubcategoryState((prev) => (prev ? { ...prev, value: e.target.value } : null))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreateSubcategory();
                if (e.key === "Escape") setNewSubcategoryState(null);
              }}
              onBlur={() => void handleCreateSubcategory()}
              placeholder="Subcategory name…"
              className="w-full rounded border border-accent bg-background px-2 py-0.5 text-xs text-text-primary outline-none focus:ring-1 focus:ring-accent"
              aria-label="New subcategory name"
            />
          </div>
        </li>
      ) : null;

      // Subcategory group renderer
      const renderSubcatGroup = (sub: SubcategoryItem, subDocs: DocumentItem[]) => {
        const subKey = `${parentId}-subcat-${sub.id}`;
        const isSubCollapsed = collapsedSections.has(subKey);

        const subHeader = (
          <li key={`subcat-header-${sub.id}`} className="group/subcat">
            <div className="flex items-center" style={{ paddingLeft: `${depth * 12 + 20}px`, paddingRight: "8px" }}>
              <button
                onClick={() => toggleSection(subKey)}
                className="flex flex-1 items-center gap-1 py-0.5 text-xs text-text-muted hover:text-text-primary"
                aria-expanded={!isSubCollapsed}
              >
                {!collapsed && <ChevronIcon expanded={!isSubCollapsed} className="h-2 w-2 shrink-0" />}
                {!collapsed && <span className="truncate">{sub.name}</span>}
              </button>
              {!collapsed && (
                <button
                  onClick={(e) => openContextMenu(e, sub.id, "subcategory", sub.name)}
                  className="invisible shrink-0 rounded p-0.5 text-text-muted hover:bg-border hover:text-text-primary group-hover/subcat:visible"
                  aria-label={`Options for subcategory ${sub.name}`}
                >
                  <DotsIcon className="h-3 w-3" />
                </button>
              )}
            </div>
          </li>
        );

        if (isSubCollapsed) return [subHeader];

        if (type === "SCENE") {
          return [
            subHeader,
            <li key={`subcat-scene-${sub.id}`}>
              <ul>
                <SortableSceneList
                  docs={subDocs}
                  depth={depth + 1}
                  pathname={pathname}
                  collapsed={collapsed}
                  availableSubcategories={typeSubs}
                  onContextMenu={(e, id, name, meta, docType, subcategoryId, avail) =>
                    openContextMenu(e, id, "document", name, meta, docType, subcategoryId, avail)
                  }
                />
              </ul>
            </li>,
          ];
        }

        return [subHeader, ...subDocs.map((d) => renderDocumentNode(d, depth + 1, typeSubs))];
      };

      if (type === "SCENE" && typeSubs.length === 0) {
        return [
          sectionLabel,
          ...(newSubcatInput ? [newSubcatInput] : []),
          <li key={`scene-list-${docs[0]?.id ?? type}`}>
            <ul>
              <SortableSceneList
                docs={docs}
                depth={depth}
                pathname={pathname}
                collapsed={collapsed}
                availableSubcategories={typeSubs}
                onContextMenu={(e, id, name, meta, docType, subcategoryId, avail) =>
                  openContextMenu(e, id, "document", name, meta, docType, subcategoryId, avail)
                }
              />
            </ul>
          </li>,
        ];
      }

      if (supportsSubcategories && typeSubs.length > 0) {
        const subcatGroups = typeSubs.flatMap((sub) => {
          const subDocs = docs.filter((d) => d.subcategoryId === sub.id);
          return renderSubcatGroup(sub, subDocs);
        });

        const uncategorizedDocs = docs.filter((d) => !typeSubs.some((s) => s.id === d.subcategoryId));

        const uncategorizedNodes =
          uncategorizedDocs.length > 0
            ? [
                <li key={`uncat-label-${parentId}-${type}`}>
                  <p
                    className="pb-0.5 pt-1 text-[10px] uppercase tracking-wide text-text-muted/50"
                    style={{ paddingLeft: `${depth * 12 + 22}px` }}
                  >
                    {!collapsed && "Uncategorized"}
                  </p>
                </li>,
                ...(type === "SCENE"
                  ? [
                      <li key={`uncat-scene-${parentId}`}>
                        <ul>
                          <SortableSceneList
                            docs={uncategorizedDocs}
                            depth={depth + 1}
                            pathname={pathname}
                            collapsed={collapsed}
                            availableSubcategories={typeSubs}
                            onContextMenu={(e, id, name, meta, docType, subcategoryId, avail) =>
                              openContextMenu(e, id, "document", name, meta, docType, subcategoryId, avail)
                            }
                          />
                        </ul>
                      </li>,
                    ]
                  : uncategorizedDocs.map((d) => renderDocumentNode(d, depth + 1, typeSubs))),
              ]
            : [];

        return [sectionLabel, ...(newSubcatInput ? [newSubcatInput] : []), ...subcatGroups, ...uncategorizedNodes];
      }

      const docNodes = docs.map((d) => renderDocumentNode(d, depth, typeSubs.length > 0 ? typeSubs : undefined));

      if (hasMap) {
        const mapNode = (
          <li key={`map-${mapHref}`}>
            <div style={{ paddingLeft: `${depth * 12 + 8}px` }}>
              <Link
                href={{ pathname: mapHref }}
                className={`flex items-center gap-1.5 rounded px-2 py-1.5 text-sm transition-colors ${
                  pathname === mapHref
                    ? "bg-accent/10 text-accent"
                    : "text-text-muted hover:bg-background hover:text-text-primary"
                }`}
                aria-label={mapAriaLabel}
                aria-current={pathname === mapHref ? "page" : undefined}
              >
                <GraphIcon className="h-3.5 w-3.5 shrink-0" />
                {!collapsed && <span className="truncate">Relationship Map</span>}
              </Link>
            </div>
          </li>
        );
        return [sectionLabel, ...(newSubcatInput ? [newSubcatInput] : []), ...docNodes, mapNode];
      }

      return [sectionLabel, ...(newSubcatInput ? [newSubcatInput] : []), ...docNodes];
    });

  const renderStoryNode = (story: StoryItem, depth: number) => {
    const isExpanded = expanded.has(story.id);

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
                  setNewDocumentModal({ parentId: story.id, parentName: story.name, parentType: "story", storyMode: story.mode });
                }}
                className="opacity-0 shrink-0 rounded p-0.5 text-text-muted hover:bg-border group-hover:opacity-100 focus:opacity-100"
                aria-label={`Add document to ${story.name}`}
                data-testid={`story-add-doc-${story.id}`}
              >
                <PlusIcon className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) =>
                  openContextMenu(e, story.id, "story", story.name, {
                    seriesId: story.seriesId,
                    universeId: story.universeId,
                  })
                }
                className="opacity-0 shrink-0 rounded p-0.5 text-text-muted hover:bg-border group-hover:opacity-100 focus:opacity-100"
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
            {renderDocumentSections(
              story.documents,
              depth + 1,
              story.id,
              "story",
              story.subcategories,
              `/dashboard/stories/${story.id}/map`,
              `Relationship Map for ${story.name}`,
              story.name,
              story.mode,
            )}
          </ul>
        )}
      </li>
    );
  };

  const renderSeriesNode = (series: SeriesItem, depth: number) => {
    const isExpanded = expanded.has(series.id);
    const hasChildren = series.stories.length > 0 || series.documents.length > 0;

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
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setNewDocumentModal({ parentId: series.id, parentName: series.name, parentType: "series" });
                }}
                className="opacity-0 shrink-0 rounded p-0.5 text-text-muted hover:bg-border group-hover:opacity-100 focus:opacity-100"
                aria-label={`Add document to ${series.name}`}
              >
                <PlusIcon className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) =>
                  openContextMenu(e, series.id, "series", series.name)
                }
                className="opacity-0 shrink-0 rounded p-0.5 text-text-muted hover:bg-border group-hover:opacity-100 focus:opacity-100"
                aria-label={`Options for ${series.name}`}
                data-testid={`series-menu-${series.id}`}
              >
                <DotsIcon className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
        {isExpanded && hasChildren && (
          <ul>
            {renderDocumentSections(
              series.documents,
              depth + 1,
              series.id,
              "series",
              series.subcategories,
            )}
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
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setNewDocumentModal({ parentId: universe.id, parentName: universe.name, parentType: "universe" });
                }}
                className="opacity-0 shrink-0 rounded p-0.5 text-text-muted hover:bg-border group-hover:opacity-100 focus:opacity-100"
                aria-label={`Add document to ${universe.name}`}
                data-testid={`universe-add-doc-${universe.id}`}
              >
                <PlusIcon className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) =>
                  openContextMenu(e, universe.id, "universe", universe.name)
                }
                className="opacity-0 shrink-0 rounded p-0.5 text-text-muted hover:bg-border group-hover:opacity-100 focus:opacity-100"
                aria-label={`Options for ${universe.name}`}
                data-testid={`universe-menu-${universe.id}`}
              >
                <DotsIcon className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
        {isExpanded && (
          <ul>
            {renderDocumentSections(
              universe.documents,
              1,
              universe.id,
              "universe",
              universe.subcategories,
              `/dashboard/universes/${universe.id}/map`,
              `Relationship Map for ${universe.name}`,
            )}
            {universe.series.map((s) => renderSeriesNode(s, 1))}
            {universe.stories.length > 0 && (
              <li key={`section-stories-${universe.id}`}>
                <button
                  onClick={() => toggleSection(`${universe.id}-stories`)}
                  className="flex w-full items-center gap-1 pb-0.5 pt-2 text-xs font-medium uppercase tracking-wide text-text-muted hover:text-text-primary"
                  style={{ paddingLeft: "20px" }}
                  aria-expanded={!collapsedSections.has(`${universe.id}-stories`)}
                >
                  {!collapsed && <ChevronIcon expanded={!collapsedSections.has(`${universe.id}-stories`)} className="h-2.5 w-2.5 shrink-0" />}
                  Stories
                </button>
              </li>
            )}
            {universe.stories.length > 0 && !collapsedSections.has(`${universe.id}-stories`) && universe.stories.map((s) => renderStoryNode(s, 1))}
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
          onSetSubcategory={
            contextMenu.type === "document" && contextMenu.availableSubcategories !== undefined
              ? (subcategoryId) => void handleSetSubcategory(contextMenu.id, subcategoryId)
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
          onMove={
            contextMenu.type === "story"
              ? () => {
                  setMoveStoryModal({
                    id: contextMenu.id,
                    name: contextMenu.name,
                    currentSeriesId:
                      typeof contextMenu.meta?.seriesId === "string"
                        ? contextMenu.meta.seriesId
                        : null,
                    currentUniverseId:
                      typeof contextMenu.meta?.universeId === "string"
                        ? contextMenu.meta.universeId
                        : null,
                  });
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
          parentName={newDocumentModal.parentName}
          parentType={newDocumentModal.parentType}
          storyMode={newDocumentModal.storyMode}
          defaultType={newDocumentModal.defaultType}
          forceType={newDocumentModal.forceType}
          onConfirm={(type, name, sourceText) =>
            void createDocument(newDocumentModal, type, name, sourceText)
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

      {/* Move story modal */}
      {moveStoryModal !== null && tree !== null && (
        <MoveStoryModal
          modal={moveStoryModal}
          tree={tree}
          onConfirm={handleMoveStory}
          onClose={() => setMoveStoryModal(null)}
        />
      )}
    </>
  );
}
