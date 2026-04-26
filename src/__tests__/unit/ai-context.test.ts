import { buildTier1Context, buildSystemPrompt } from "@/lib/ai-context";
import type { ChatMessage } from "@/lib/ai-context";
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
});
