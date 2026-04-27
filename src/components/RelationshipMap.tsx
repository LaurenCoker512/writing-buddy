"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  Position,
  type NodeTypes,
  type Node,
  type Edge,
  type EdgeMouseHandler,
  type NodeMouseHandler,
} from "reactflow";
import "reactflow/dist/style.css";
import { buildGraph, type GraphDocument } from "@/lib/graph-builder";

// ── Character node ─────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  Protagonist: "bg-blue-100 text-blue-800",
  Antagonist: "bg-red-100 text-red-800",
  Supporting: "bg-green-100 text-green-800",
  Other: "bg-gray-100 text-gray-700",
};

function CharacterNode({ data }: { data: { name: string; role: string | null } }) {
  const colorClass = data.role ? (ROLE_COLORS[data.role] ?? ROLE_COLORS.Other) : ROLE_COLORS.Other;
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-2 shadow-sm min-w-[140px] text-center cursor-pointer hover:border-accent transition-colors">
      <Handle type="target" position={Position.Top} className="!bg-border" />
      <div className="text-sm font-medium text-text-primary truncate">{data.name}</div>
      {data.role && (
        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
          {data.role}
        </span>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-border" />
    </div>
  );
}

const nodeTypes: NodeTypes = { characterNode: CharacterNode };

// ── Mobile fallback ────────────────────────────────────────────────────────────

function MobileFallback({
  documents,
  onNavigate,
}: {
  documents: GraphDocument[];
  onNavigate: (id: string) => void;
}) {
  const characters = documents.filter((d) => d.type === "CHARACTER");
  const relationships = documents.filter((d) => d.type === "RELATIONSHIP");

  return (
    <div className="p-4 space-y-6">
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
          Characters ({characters.length})
        </h2>
        <ul className="space-y-1">
          {characters.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => onNavigate(c.id)}
                className="w-full rounded px-3 py-2 text-left text-sm hover:bg-background"
                aria-label={`Open ${c.name}`}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
          Relationships ({relationships.length})
        </h2>
        <ul className="space-y-1">
          {relationships.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => onNavigate(r.id)}
                className="w-full rounded px-3 py-2 text-left text-sm hover:bg-background"
                aria-label={`Open ${r.name}`}
              >
                {r.name}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface RelationshipMapProps {
  storyId: string | null;
  universeId: string | null;
  storyName: string;
  universeName: string | null;
  isMobile: boolean;
}

export default function RelationshipMap({
  storyId,
  universeId,
  storyName,
  universeName,
  isMobile,
}: RelationshipMapProps) {
  const router = useRouter();
  const [scope, setScope] = useState<"story" | "universe">(
    storyId !== null ? "story" : "universe",
  );
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [documents, setDocuments] = useState<GraphDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    const scopeId = scope === "universe" && universeId ? universeId : storyId;
    const scopeParam = scope === "universe" && universeId ? "universeId" : "storyId";

    if (!scopeId) {
      setLoading(false);
      return;
    }

    const res = await fetch(
      `/api/documents?${scopeParam}=${scopeId}&types=CHARACTER,RELATIONSHIP`,
    );
    if (!res.ok) {
      setLoading(false);
      return;
    }

    const docs = (await res.json()) as GraphDocument[];
    setDocuments(docs);
    const { nodes: n, edges: e } = buildGraph(docs);
    setNodes(n);
    setEdges(e);
    setLoading(false);
  }, [scope, storyId, universeId]);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      router.push(`/dashboard/documents/${node.data.documentId as string}`);
    },
    [router],
  );

  const handleEdgeClick: EdgeMouseHandler = useCallback(
    (_event, edge) => {
      router.push(`/dashboard/documents/${edge.data.documentId as string}`);
    },
    [router],
  );

  const handleNavigate = useCallback(
    (id: string) => {
      router.push(`/dashboard/documents/${id}`);
    },
    [router],
  );

  const isEmpty = !loading && nodes.length === 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h1 className="text-base font-semibold text-text-primary">Relationship Map</h1>
          <p className="text-sm text-text-muted">
            {scope === "universe" && universeName ? universeName : storyName}
          </p>
        </div>
        {storyId !== null && universeId !== null && (
          <div
            className="flex rounded-lg border border-border text-sm overflow-hidden"
            role="group"
            aria-label="Map scope"
          >
            <button
              onClick={() => setScope("story")}
              className={`px-3 py-1.5 transition-colors ${
                scope === "story"
                  ? "bg-accent text-white"
                  : "text-text-primary hover:bg-background"
              }`}
              data-testid="scope-story"
            >
              This Story
            </button>
            <button
              onClick={() => setScope("universe")}
              className={`px-3 py-1.5 transition-colors ${
                scope === "universe"
                  ? "bg-accent text-white"
                  : "text-text-primary hover:bg-background"
              }`}
              data-testid="scope-universe"
            >
              Full Universe
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-text-muted text-sm">
            Loading…
          </div>
        )}
        {!loading && isEmpty && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted">
            <p className="text-sm">No characters or relationships yet.</p>
            <p className="mt-1 text-xs">Add Character and Relationship documents to see the graph.</p>
          </div>
        )}
        {!loading && !isEmpty && (
          isMobile ? (
            <MobileFallback documents={documents} onNavigate={handleNavigate} />
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
              fitView
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={true}
              data-testid="relationship-map-flow"
            >
              <Background />
              <Controls />
            </ReactFlow>
          )
        )}
      </div>
    </div>
  );
}
