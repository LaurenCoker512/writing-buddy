jest.mock("@/auth", () => ({ auth: jest.fn() }));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    document: { findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn() },
    chatMessage: {
      findMany: jest.fn(),
      count: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/encryption", () => ({
  decryptApiKey: jest.fn().mockReturnValue("plaintext-api-key"),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

import { NextRequest } from "next/server";
import { POST } from "@/app/api/ai/chat/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AI_CONFIG } from "@/config/ai";

const mockAuth = auth as jest.Mock;
const mockDocFindFirst = prisma.document.findFirst as jest.Mock;
const mockDocFindUnique = prisma.document.findUnique as jest.Mock;
const mockUserFindUnique = prisma.user.findUnique as jest.Mock;
const mockChatFindMany = prisma.chatMessage.findMany as jest.Mock;
const mockChatCount = prisma.chatMessage.count as jest.Mock;
const mockChatCreateMany = prisma.chatMessage.createMany as jest.Mock;
const mockTransaction = prisma.$transaction as jest.Mock;

const authed = { user: { id: "user-1" } };

const existingDocument = {
  id: "doc-1",
  type: "CHARACTER",
  name: "Aragorn",
  tiptapJson: { type: "doc", content: [] },
  chatSummary: null,
  storyId: "story-1",
  seriesId: null,
  universeId: null,
  story: { userId: "user-1", mode: "ORIGINAL", rating: "T" },
  series: null,
  universe: null,
};

function makeSseStream(content: string): Response {
  const encoder = new TextEncoder();
  const payload = `data: ${JSON.stringify({
    choices: [{ delta: { content } }],
  })}\n\ndata: [DONE]\n\n`;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function makeSummaryResponse(summary: string): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: summary } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ai/chat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue(authed);
  mockDocFindFirst.mockResolvedValue(existingDocument);
  (prisma.document.findMany as jest.Mock).mockResolvedValue([]);
  mockUserFindUnique.mockResolvedValue({ openRouterKey: "encrypted-key" });
  mockChatFindMany.mockResolvedValue([]);
  mockChatCount.mockResolvedValue(2);
  mockChatCreateMany.mockResolvedValue({ count: 2 });
  mockTransaction.mockResolvedValue([]);
  mockFetch.mockResolvedValue(makeSseStream("Hello!"));
});

describe("POST /api/ai/chat — persistence", () => {
  test("persists user and assistant ChatMessage rows after streaming", async () => {
    const res = await POST(makeRequest({ documentId: "doc-1", content: "Tell me about this" }));
    expect(res.status).toBe(200);
    await res.text();

    expect(mockChatCreateMany).toHaveBeenCalledWith({
      data: [
        { documentId: "doc-1", role: "user", content: "Tell me about this" },
        { documentId: "doc-1", role: "assistant", content: "Hello!" },
      ],
    });
  });

  test("does not persist messages when API key is absent", async () => {
    mockUserFindUnique.mockResolvedValue({ openRouterKey: null });
    const res = await POST(makeRequest({ documentId: "doc-1", content: "Hello" }));
    expect(res.status).toBe(402);
    expect(mockChatCreateMany).not.toHaveBeenCalled();
  });

  test("loads chat history from DB for context", async () => {
    const dbMessages = [
      { id: "m-1", role: "user", content: "Old question", createdAt: new Date() },
      { id: "m-2", role: "assistant", content: "Old answer", createdAt: new Date() },
    ];
    mockChatFindMany.mockResolvedValue(dbMessages);

    const res = await POST(makeRequest({ documentId: "doc-1", content: "New question" }));
    await res.text();

    expect(mockChatFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { documentId: "doc-1" } }),
    );
  });

  test("pruning is not triggered when count is below CHAT_RETENTION_LIMIT", async () => {
    mockChatCount.mockResolvedValue(AI_CONFIG.CHAT_RETENTION_LIMIT - 1);
    const res = await POST(makeRequest({ documentId: "doc-1", content: "Hello" }));
    await res.text();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("pruning is triggered when count reaches CHAT_RETENTION_LIMIT", async () => {
    mockChatCount.mockResolvedValue(AI_CONFIG.CHAT_RETENTION_LIMIT);

    const oldestBatch = Array.from({ length: AI_CONFIG.CHAT_SUMMARIZE_BATCH }, (_, i) => ({
      id: `msg-${i}`,
      role: "user",
      content: `Message ${i}`,
      createdAt: new Date(Date.now() + i * 1000),
    }));

    mockChatFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(oldestBatch);

    mockDocFindUnique.mockResolvedValue({ chatSummary: null });

    mockFetch
      .mockResolvedValueOnce(makeSseStream("Response"))
      .mockResolvedValueOnce(makeSummaryResponse("Summary text"));

    const res = await POST(makeRequest({ documentId: "doc-1", content: "Hello" }));
    await res.text();

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe("POST /api/ai/chat — summarization", () => {
  test("summarizes oldest CHAT_SUMMARIZE_BATCH messages and deletes them", async () => {
    mockChatCount.mockResolvedValue(80);

    const oldestBatch = Array.from({ length: 30 }, (_, i) => ({
      id: `msg-${i}`,
      role: "user",
      content: `Message ${i}`,
      createdAt: new Date(Date.now() + i * 1000),
    }));

    mockChatFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(oldestBatch);

    mockDocFindUnique.mockResolvedValue({ chatSummary: null });

    mockFetch
      .mockResolvedValueOnce(makeSseStream("Response"))
      .mockResolvedValueOnce(makeSummaryResponse("Rolling summary"));

    const res = await POST(makeRequest({ documentId: "doc-1", content: "Hello" }));
    await res.text();

    expect(mockTransaction).toHaveBeenCalled();
  });

  test("incorporates existing chatSummary into the summarization prompt", async () => {
    const docWithSummary = { ...existingDocument, chatSummary: "Previous summary text" };
    mockDocFindFirst.mockResolvedValue(docWithSummary);
    mockChatCount.mockResolvedValue(AI_CONFIG.CHAT_RETENTION_LIMIT);

    const oldestBatch = Array.from({ length: AI_CONFIG.CHAT_SUMMARIZE_BATCH }, (_, i) => ({
      id: `msg-${i}`,
      role: "user",
      content: `Message ${i}`,
      createdAt: new Date(Date.now() + i * 1000),
    }));

    mockChatFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(oldestBatch);

    mockDocFindUnique.mockResolvedValue({ chatSummary: "Previous summary text" });

    mockFetch
      .mockResolvedValueOnce(makeSseStream("Response"))
      .mockResolvedValueOnce(makeSummaryResponse("Updated summary"));

    const res = await POST(makeRequest({ documentId: "doc-1", content: "Hello" }));
    await res.text();

    const summaryFetchBody = JSON.parse(
      (mockFetch.mock.calls[1] as [string, { body: string }])[1].body,
    ) as { messages: Array<{ content: string }> };

    const userMsg = summaryFetchBody.messages.find((m) => (m as { role?: string }).role === "user");
    expect(userMsg?.content).toContain("Previous summary text");
  });
});
