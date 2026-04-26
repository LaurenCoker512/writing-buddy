import {
  buildTier1Context,
  buildSystemPrompt,
  sortSiblingDocuments,
  buildTier2Context,
} from "@/lib/ai-context";
import type { ChatMessage, SiblingDocument } from "@/lib/ai-context";
import { AI_CONFIG } from "@/config/ai";

const sampleTiptapJson = {
  type: "doc" as const,
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "My Character" }],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "Some description." }],
    },
  ],
};

describe("buildTier1Context", () => {
  test("converts tiptapJson to Markdown", () => {
    const { documentMarkdown } = buildTier1Context(sampleTiptapJson, []);
    expect(documentMarkdown).toContain("# My Character");
    expect(documentMarkdown).toContain("Some description.");
  });

  test("returns all messages when within CHAT_FULL_WINDOW", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "msg 1" },
      { role: "assistant", content: "reply 1" },
    ];
    const { recentMessages } = buildTier1Context(sampleTiptapJson, messages);
    expect(recentMessages).toHaveLength(2);
  });

  test("omits messages beyond CHAT_FULL_WINDOW, keeping most recent", () => {
    const total = AI_CONFIG.CHAT_FULL_WINDOW + 3;
    const messages: ChatMessage[] = Array.from({ length: total }, (_, index) => ({
      role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `message ${index}`,
    }));
    const { recentMessages } = buildTier1Context(sampleTiptapJson, messages);
    expect(recentMessages).toHaveLength(AI_CONFIG.CHAT_FULL_WINDOW);
    expect(recentMessages[0].content).toBe(`message ${total - AI_CONFIG.CHAT_FULL_WINDOW}`);
  });

  test("returns empty recentMessages for empty history", () => {
    const { recentMessages } = buildTier1Context(sampleTiptapJson, []);
    expect(recentMessages).toHaveLength(0);
  });

  test("returns empty documentMarkdown for empty doc", () => {
    const { documentMarkdown } = buildTier1Context({ type: "doc", content: [] }, []);
    expect(documentMarkdown).toBe("");
  });
});

describe("buildSystemPrompt", () => {
  test("includes 'original fiction' for ORIGINAL mode", () => {
    const prompt = buildSystemPrompt("# Doc", "ORIGINAL", "T");
    expect(prompt).toContain("original fiction");
    expect(prompt).not.toContain("fanfiction");
  });

  test("includes 'fanfiction' for FANFIC mode", () => {
    const prompt = buildSystemPrompt("# Doc", "FANFIC", "T");
    expect(prompt).toContain("fanfiction");
    expect(prompt).not.toContain("original fiction");
  });

  test("includes the rating code", () => {
    const prompt = buildSystemPrompt("# Doc", "ORIGINAL", "M");
    expect(prompt).toContain("M");
  });

  test("includes document content in the prompt", () => {
    const prompt = buildSystemPrompt("# My Character\n\nSome text.", "ORIGINAL", "G");
    expect(prompt).toContain("# My Character");
    expect(prompt).toContain("Some text.");
  });

  test("uses placeholder when document is empty", () => {
    const prompt = buildSystemPrompt("", "ORIGINAL", "G");
    expect(prompt).toContain("(empty document)");
  });

  test("includes tier2Context when provided", () => {
    const prompt = buildSystemPrompt("# Doc", "ORIGINAL", "G", null, "### Aria (CHARACTER)\nA rogue.");
    expect(prompt).toContain("Related documents");
    expect(prompt).toContain("Aria");
  });

  test("omits tier2Context section when not provided", () => {
    const prompt = buildSystemPrompt("# Doc", "ORIGINAL", "G");
    expect(prompt).not.toContain("Related documents");
  });
});

describe("sortSiblingDocuments", () => {
  const docs: SiblingDocument[] = [
    { id: "1", type: "WORLDBUILDING", name: "Lore", contentSummary: "Lore text" },
    { id: "2", type: "CHARACTER", name: "Aria", contentSummary: "Aria text" },
    { id: "3", type: "CHARACTER", name: "Bran", contentSummary: "Bran text" },
    { id: "4", type: "PLOT", name: "Act 1", contentSummary: "Plot text" },
  ];

  test("puts same-type documents first", () => {
    const sorted = sortSiblingDocuments(docs, "CHARACTER");
    expect(sorted[0].type).toBe("CHARACTER");
    expect(sorted[1].type).toBe("CHARACTER");
  });

  test("sorts remaining documents by canonical type order", () => {
    const sorted = sortSiblingDocuments(docs, "PLOT");
    expect(sorted[0].name).toBe("Act 1");
    expect(sorted[1].type).toBe("CHARACTER");
    expect(sorted[3].type).toBe("WORLDBUILDING");
  });

  test("handles empty array", () => {
    expect(sortSiblingDocuments([], "CHARACTER")).toEqual([]);
  });
});

describe("buildTier2Context", () => {
  const siblings: SiblingDocument[] = [
    { id: "1", type: "PLOT", name: "Act 1", contentSummary: "Plot summary." },
    { id: "2", type: "CHARACTER", name: "Aria", contentSummary: "Aria summary." },
  ];

  test("returns formatted summaries sorted by type priority", () => {
    const ctx = buildTier2Context(siblings, "CHARACTER");
    const ariaIndex = ctx.indexOf("Aria");
    const plotIndex = ctx.indexOf("Act 1");
    expect(ariaIndex).toBeLessThan(plotIndex);
  });

  test("excludes documents with null contentSummary", () => {
    const withNull: SiblingDocument[] = [
      ...siblings,
      { id: "3", type: "WORLDBUILDING", name: "Magic", contentSummary: null },
    ];
    const ctx = buildTier2Context(withNull, "CHARACTER");
    expect(ctx).not.toContain("Magic");
  });

  test("stops including summaries when budget is exceeded without truncating mid-document", () => {
    const largeSummary = "x".repeat(400);
    const docs: SiblingDocument[] = [
      { id: "1", type: "CHARACTER", name: "A", contentSummary: largeSummary },
      { id: "2", type: "CHARACTER", name: "B", contentSummary: largeSummary },
      { id: "3", type: "CHARACTER", name: "C", contentSummary: largeSummary },
    ];
    // budget of 200 tokens = 800 chars, each entry is ~400 chars + header overhead
    // first doc fits, second would exceed
    const ctx = buildTier2Context(docs, "CHARACTER", 200);
    expect(ctx).toContain("### A");
    expect(ctx).not.toContain("### B");
    expect(ctx).not.toContain("### C");
  });

  test("returns empty string when no siblings have summaries", () => {
    const empty: SiblingDocument[] = [
      { id: "1", type: "CHARACTER", name: "Ghost", contentSummary: null },
    ];
    expect(buildTier2Context(empty, "PLOT")).toBe("");
  });
});
