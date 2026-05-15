import type { Editor } from "@tiptap/core";
import { applyTrackedChangesToEditor, resolveTrackedChanges } from "@/lib/diff-to-tiptap";
import type { TipTapDoc } from "@/lib/section-utils";
import type { TipTapNode } from "@/lib/tiptap-to-markdown";
import type { DiffProposal } from "@/types/diff";

// Minimal editor mock — only the surface area used by the two utilities
function createMockEditor(doc: TipTapDoc): { editor: Editor; getDoc: () => TipTapDoc } {
  let currentDoc = doc;
  const editor = {
    getJSON: () => currentDoc,
    commands: {
      setContent: (newDoc: unknown) => {
        currentDoc = newDoc as TipTapDoc;
      },
    },
  } as unknown as Editor;
  return { editor, getDoc: () => currentDoc };
}

const BASE_DOC: TipTapDoc = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Background" }] },
    { type: "paragraph", content: [{ type: "text", text: "She grew up in a small town." }] },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Other" }] },
    { type: "paragraph", content: [{ type: "text", text: "Other content." }] },
  ],
};

function findTextNodesWithMark(nodes: TipTapNode[], markType: string): TipTapNode[] {
  const results: TipTapNode[] = [];
  for (const node of nodes) {
    if (node.type === "text" && node.marks?.some((m) => m.type === markType)) {
      results.push(node);
    }
    if (node.content) {
      results.push(...findTextNodesWithMark(node.content, markType));
    }
  }
  return results;
}

function allTextNodes(nodes: TipTapNode[]): TipTapNode[] {
  const results: TipTapNode[] = [];
  for (const node of nodes) {
    if (node.type === "text") results.push(node);
    if (node.content) results.push(...allTextNodes(node.content));
  }
  return results;
}

// ── applyTrackedChangesToEditor ───────────────────────────────────────────────

describe("applyTrackedChangesToEditor — word-level diff", () => {
  const proposal: DiffProposal = {
    id: "p1",
    heading: "Background",
    headingLevel: 2,
    beforeMarkdown: "## Background\n\nShe grew up in a small town.",
    newMarkdown: "## Background\n\nShrouded in secrecy from birth.",
    isNew: false,
  };

  test("produces trackedDelete nodes for removed text", () => {
    const { editor, getDoc } = createMockEditor(structuredClone(BASE_DOC));
    applyTrackedChangesToEditor(editor, proposal);
    const deleted = findTextNodesWithMark(getDoc().content, "trackedDelete");
    expect(deleted.length).toBeGreaterThan(0);
    expect(deleted.every((n) => n.marks?.some((m) => m.attrs?.["proposalId"] === "p1"))).toBe(true);
  });

  test("produces trackedInsert nodes for added text", () => {
    const { editor, getDoc } = createMockEditor(structuredClone(BASE_DOC));
    applyTrackedChangesToEditor(editor, proposal);
    const inserted = findTextNodesWithMark(getDoc().content, "trackedInsert");
    expect(inserted.length).toBeGreaterThan(0);
    expect(inserted.every((n) => n.marks?.some((m) => m.attrs?.["proposalId"] === "p1"))).toBe(true);
  });

  test("preserves unchanged sections outside the target", () => {
    const { editor, getDoc } = createMockEditor(structuredClone(BASE_DOC));
    applyTrackedChangesToEditor(editor, proposal);
    const otherHeading = getDoc().content.find(
      (n) => n.type === "heading" && n.content?.[0]?.text === "Other",
    );
    expect(otherHeading).toBeDefined();
  });
});

describe("applyTrackedChangesToEditor — heading-structure fallback", () => {
  // beforeMarkdown body itself contains a sub-heading → triggers fallback
  const proposal: DiffProposal = {
    id: "p2",
    heading: "Background",
    headingLevel: 2,
    beforeMarkdown: "## Background\n\n### Sub-section\n\nOld content.",
    newMarkdown: "## Background\n\n### Sub-section\n\nNew content.",
    isNew: false,
  };

  test("produces a trackedInsert block AND a trackedDelete block", () => {
    const { editor, getDoc } = createMockEditor(structuredClone(BASE_DOC));
    applyTrackedChangesToEditor(editor, proposal);
    const inserted = findTextNodesWithMark(getDoc().content, "trackedInsert");
    const deleted = findTextNodesWithMark(getDoc().content, "trackedDelete");
    expect(inserted.length).toBeGreaterThan(0);
    expect(deleted.length).toBeGreaterThan(0);
  });
});

describe("applyTrackedChangesToEditor — isNew proposal", () => {
  const proposal: DiffProposal = {
    id: "p3",
    heading: null,
    headingLevel: 2,
    beforeMarkdown: "",
    newMarkdown: "## New Section\n\nFresh content here.",
    isNew: true,
  };

  test("appends new content wrapped entirely in trackedInsert", () => {
    const { editor, getDoc } = createMockEditor(structuredClone(BASE_DOC));
    applyTrackedChangesToEditor(editor, proposal);
    const inserted = findTextNodesWithMark(getDoc().content, "trackedInsert");
    expect(inserted.length).toBeGreaterThan(0);
    // All inserted nodes carry the right proposalId
    expect(inserted.every((n) => n.marks?.some((m) => m.attrs?.["proposalId"] === "p3"))).toBe(true);
  });

  test("does not add any trackedDelete nodes for isNew proposals", () => {
    const { editor, getDoc } = createMockEditor(structuredClone(BASE_DOC));
    applyTrackedChangesToEditor(editor, proposal);
    const deleted = findTextNodesWithMark(getDoc().content, "trackedDelete");
    expect(deleted).toHaveLength(0);
  });
});

// ── resolveTrackedChanges ─────────────────────────────────────────────────────

function docWithTrackedChanges(): TipTapDoc {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Unchanged text. " },
          {
            type: "text",
            text: "Inserted text.",
            marks: [{ type: "trackedInsert", attrs: { proposalId: "p1" } }],
          },
          {
            type: "text",
            text: "Deleted text.",
            marks: [{ type: "trackedDelete", attrs: { proposalId: "p1" } }],
          },
        ],
      },
    ],
  };
}

describe("resolveTrackedChanges — accept", () => {
  test("removes trackedDelete text", () => {
    const { editor, getDoc } = createMockEditor(docWithTrackedChanges());
    resolveTrackedChanges(editor, "p1", true);
    const deleted = findTextNodesWithMark(getDoc().content, "trackedDelete");
    expect(deleted).toHaveLength(0);
  });

  test("strips trackedInsert mark but keeps the text", () => {
    const { editor, getDoc } = createMockEditor(docWithTrackedChanges());
    resolveTrackedChanges(editor, "p1", true);
    const inserted = findTextNodesWithMark(getDoc().content, "trackedInsert");
    expect(inserted).toHaveLength(0);
    const texts = allTextNodes(getDoc().content).map((n) => n.text);
    expect(texts).toContain("Inserted text.");
  });

  test("preserves unchanged text", () => {
    const { editor, getDoc } = createMockEditor(docWithTrackedChanges());
    resolveTrackedChanges(editor, "p1", true);
    const texts = allTextNodes(getDoc().content).map((n) => n.text);
    expect(texts).toContain("Unchanged text. ");
  });
});

describe("resolveTrackedChanges — reject", () => {
  test("removes trackedInsert text", () => {
    const { editor, getDoc } = createMockEditor(docWithTrackedChanges());
    resolveTrackedChanges(editor, "p1", false);
    const texts = allTextNodes(getDoc().content).map((n) => n.text);
    expect(texts).not.toContain("Inserted text.");
  });

  test("strips trackedDelete mark but keeps the text", () => {
    const { editor, getDoc } = createMockEditor(docWithTrackedChanges());
    resolveTrackedChanges(editor, "p1", false);
    const deleted = findTextNodesWithMark(getDoc().content, "trackedDelete");
    expect(deleted).toHaveLength(0);
    const texts = allTextNodes(getDoc().content).map((n) => n.text);
    expect(texts).toContain("Deleted text.");
  });

  test("preserves unchanged text", () => {
    const { editor, getDoc } = createMockEditor(docWithTrackedChanges());
    resolveTrackedChanges(editor, "p1", false);
    const texts = allTextNodes(getDoc().content).map((n) => n.text);
    expect(texts).toContain("Unchanged text. ");
  });
});

describe("resolveTrackedChanges — unrelated proposals untouched", () => {
  function docWithTwoProposals(): TipTapDoc {
    return {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "P1 insert.",
              marks: [{ type: "trackedInsert", attrs: { proposalId: "p1" } }],
            },
            {
              type: "text",
              text: "P2 insert.",
              marks: [{ type: "trackedInsert", attrs: { proposalId: "p2" } }],
            },
          ],
        },
      ],
    };
  }

  test("accepting p1 does not remove p2 tracked changes", () => {
    const { editor, getDoc } = createMockEditor(docWithTwoProposals());
    resolveTrackedChanges(editor, "p1", true);
    const p2Nodes = findTextNodesWithMark(getDoc().content, "trackedInsert").filter((n) =>
      n.marks?.some((m) => m.attrs?.["proposalId"] === "p2"),
    );
    expect(p2Nodes.length).toBeGreaterThan(0);
  });
});
