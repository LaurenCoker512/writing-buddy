import { buildGraph, type GraphDocument } from "@/lib/graph-builder";

function makeChar(id: string, name: string, role?: string): GraphDocument {
  return { id, name, type: "CHARACTER", meta: role ? { role } : {} };
}

function makeRel(
  id: string,
  name: string,
  charA: string,
  charB: string,
  relType?: string,
): GraphDocument {
  return {
    id,
    name,
    type: "RELATIONSHIP",
    meta: { characterIds: [charA, charB], relationshipType: relType ?? "Ally" },
  };
}

describe("buildGraph — nodes", () => {
  test("produces one node per CHARACTER document", () => {
    const docs = [makeChar("c1", "Alice"), makeChar("c2", "Bob")];
    const { nodes } = buildGraph(docs);
    expect(nodes).toHaveLength(2);
    expect(nodes.map((n) => n.id)).toEqual(expect.arrayContaining(["c1", "c2"]));
  });

  test("node data contains name and role", () => {
    const docs = [makeChar("c1", "Alice", "Protagonist")];
    const { nodes } = buildGraph(docs);
    expect(nodes[0].data).toMatchObject({ name: "Alice", role: "Protagonist" });
  });

  test("node data role is null when not specified", () => {
    const docs = [makeChar("c1", "Alice")];
    const { nodes } = buildGraph(docs);
    expect(nodes[0].data.role).toBeNull();
  });

  test("non-CHARACTER documents are not included as nodes", () => {
    const docs = [makeChar("c1", "Alice"), makeRel("r1", "Rel", "c1", "c2")];
    const { nodes } = buildGraph(docs);
    expect(nodes).toHaveLength(1);
  });
});

describe("buildGraph — edges", () => {
  test("produces one edge per RELATIONSHIP document with valid characterIds", () => {
    const docs = [
      makeChar("c1", "Alice"),
      makeChar("c2", "Bob"),
      makeRel("r1", "Rel", "c1", "c2", "Family"),
    ];
    const { edges } = buildGraph(docs);
    expect(edges).toHaveLength(1);
    expect(edges[0].id).toBe("r1");
    expect(edges[0].label).toBe("Family");
  });

  test("edge direction — Mentor type has markerEnd", () => {
    const docs = [
      makeChar("c1", "Alice"),
      makeChar("c2", "Bob"),
      makeRel("r1", "Rel", "c1", "c2", "Mentor"),
    ];
    const { edges } = buildGraph(docs);
    expect(edges[0].markerEnd).toBeDefined();
  });

  test("edge direction — Ally type has no markerEnd", () => {
    const docs = [
      makeChar("c1", "Alice"),
      makeChar("c2", "Bob"),
      makeRel("r1", "Rel", "c1", "c2", "Ally"),
    ];
    const { edges } = buildGraph(docs);
    expect(edges[0].markerEnd).toBeUndefined();
  });

  test("RELATIONSHIP doc whose characterIds reference a deleted character is omitted", () => {
    const docs = [
      makeChar("c1", "Alice"),
      // c2 not present
      makeRel("r1", "Rel", "c1", "c2-missing", "Family"),
    ];
    const { edges } = buildGraph(docs);
    expect(edges).toHaveLength(0);
  });

  test("RELATIONSHIP doc with fewer than 2 characterIds is omitted", () => {
    const docs = [
      makeChar("c1", "Alice"),
      { id: "r1", name: "Rel", type: "RELATIONSHIP", meta: { characterIds: ["c1"] } },
    ];
    const { edges } = buildGraph(docs);
    expect(edges).toHaveLength(0);
  });

  test("RELATIONSHIP doc with no meta is omitted without throwing", () => {
    const docs = [
      makeChar("c1", "Alice"),
      { id: "r1", name: "Rel", type: "RELATIONSHIP", meta: null },
    ];
    expect(() => buildGraph(docs)).not.toThrow();
    const { edges } = buildGraph(docs);
    expect(edges).toHaveLength(0);
  });
});

describe("buildGraph — layout", () => {
  test("all nodes receive a numeric position from dagre layout", () => {
    const docs = [makeChar("c1", "Alice"), makeChar("c2", "Bob")];
    const { nodes } = buildGraph(docs);
    for (const node of nodes) {
      expect(typeof node.position.x).toBe("number");
      expect(typeof node.position.y).toBe("number");
    }
  });
});
