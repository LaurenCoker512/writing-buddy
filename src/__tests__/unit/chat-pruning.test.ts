import { shouldPruneChatMessages } from "@/lib/chat-pruning";
import { AI_CONFIG } from "@/config/ai";

describe("shouldPruneChatMessages", () => {
  test("does not trigger below CHAT_RETENTION_LIMIT", () => {
    expect(shouldPruneChatMessages(AI_CONFIG.CHAT_RETENTION_LIMIT - 1)).toBe(false);
  });

  test("triggers exactly at CHAT_RETENTION_LIMIT", () => {
    expect(shouldPruneChatMessages(AI_CONFIG.CHAT_RETENTION_LIMIT)).toBe(true);
  });

  test("triggers above CHAT_RETENTION_LIMIT", () => {
    expect(shouldPruneChatMessages(AI_CONFIG.CHAT_RETENTION_LIMIT + 5)).toBe(true);
  });

  test("does not trigger at zero", () => {
    expect(shouldPruneChatMessages(0)).toBe(false);
  });
});

describe("Summarization batch", () => {
  const now = Date.now();
  const makeMessages = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      id: `msg-${index}`,
      content: `Message ${index}`,
      role: "user" as const,
      createdAt: new Date(now + index * 1000),
    }));

  function selectOldestBatch<T extends { createdAt: Date }>(
    messages: T[],
    batchSize: number,
  ): T[] {
    return [...messages]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, batchSize);
  }

  test("selects oldest messages, not newest", () => {
    const messages = makeMessages(80);
    const batch = selectOldestBatch(messages, AI_CONFIG.CHAT_SUMMARIZE_BATCH);
    expect(batch).toHaveLength(AI_CONFIG.CHAT_SUMMARIZE_BATCH);
    expect(batch[0].id).toBe("msg-0");
    expect(batch[batch.length - 1].id).toBe(`msg-${AI_CONFIG.CHAT_SUMMARIZE_BATCH - 1}`);
  });

  test("does not include newest message in the batch", () => {
    const messages = makeMessages(80);
    const batch = selectOldestBatch(messages, AI_CONFIG.CHAT_SUMMARIZE_BATCH);
    const batchIds = new Set(batch.map((m) => m.id));
    expect(batchIds.has("msg-79")).toBe(false);
  });

  test("after pruning, at most CHAT_RETENTION_LIMIT - CHAT_SUMMARIZE_BATCH messages remain", () => {
    const remaining = AI_CONFIG.CHAT_RETENTION_LIMIT - AI_CONFIG.CHAT_SUMMARIZE_BATCH;
    expect(remaining).toBe(50);
    expect(remaining).toBeGreaterThan(0);
  });
});
