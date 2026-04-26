import type { Node, Edge } from "reactflow";
import { MarkerType } from "reactflow";
import dagre from "@dagrejs/dagre";
import { isRelationshipMeta, isCharacterMeta } from "./document-meta";

export interface GraphDocument {
  id: string;
  name: string;
  type: string;
  meta: unknown;
}

export interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;

const DIRECTIONAL_TYPES = new Set(["Mentor", "Rival"]);

export function buildGraph(documents: GraphDocument[]): GraphData {
  const characters = documents.filter((d) => d.type === "CHARACTER");
  const relationships = documents.filter((d) => d.type === "RELATIONSHIP");

  const characterIds = new Set(characters.map((c) => c.id));

  const nodes: Node[] = characters.map((char) => {
    const meta = isCharacterMeta(char.meta) ? char.meta : {};
    return {
      id: char.id,
      type: "characterNode",
      data: { documentId: char.id, name: char.name, role: meta.role ?? null },
      position: { x: 0, y: 0 },
    };
  });

  const edges: Edge[] = [];
  for (const rel of relationships) {
    if (!isRelationshipMeta(rel.meta)) continue;
    const ids = rel.meta.characterIds ?? [];
    if (ids.length < 2) continue;
    const [sourceId, targetId] = ids;
    if (!characterIds.has(sourceId) || !characterIds.has(targetId)) continue;

    const relType = rel.meta.relationshipType ?? "";
    edges.push({
      id: rel.id,
      source: sourceId,
      target: targetId,
      label: relType,
      data: { documentId: rel.id },
      markerEnd: DIRECTIONAL_TYPES.has(relType) ? { type: MarkerType.ArrowClosed } : undefined,
      type: "smoothstep",
    });
  }

  return applyDagreLayout({ nodes, edges });
}

function applyDagreLayout(graph: GraphData): GraphData {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", ranksep: 80, nodesep: 60 });

  for (const node of graph.nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of graph.edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const nodes = graph.nodes.map((node) => {
    const { x, y } = g.node(node.id);
    return { ...node, position: { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 } };
  });

  return { nodes, edges: graph.edges };
}
