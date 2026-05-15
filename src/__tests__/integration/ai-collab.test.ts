jest.mock("@/auth", () => ({ auth: jest.fn() }));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    document: { findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    chatMessage: {
      findMany: jest.fn(),
      count: jest.fn(),
      createMany: jest.fn(),
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
import { POST } from "@/app/api/ai/collab/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = auth as jest.Mock;
const mockDocFindFirst = prisma.document.findFirst as jest.Mock;
const mockUserFindUnique = prisma.user.findUnique as jest.Mock;
const mockChatFindMany = prisma.chatMessage.findMany as jest.Mock;
const mockChatCount = prisma.chatMessage.count as jest.Mock;
const mockChatCreateMany = prisma.chatMessage.createMany as jest.Mock;

const authed = { user: { id: "user-1" } };

const existingDocument = {
  id: "doc-1",
  type: "CHARACTER",
  name: "Aragorn",
  tiptapJson: {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Background" }] },
      { type: "paragraph", content: [{ type: "text", text: "Original content." }] },
    ],
  },
  chatSummary: null,
  storyId: "story-1",
  seriesId: null,
  universeId: null,
  story: { userId: "user-1", mode: "ORIGINAL", rating: "T" },
  series: null,
  universe: null,
};

const contextDocument = {
  id: "doc-2",
  type: "WORLDBUILDING",
  name: "The Shire",
  tiptapJson: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "A peaceful place." }] }],
  },
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

function makeJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ai/collab", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const chatBody = {
  documentId: "doc-1",
  content: "What motivates this character?",
  additionalDocumentIds: [],
  responseType: "chat",
};

const editBody = {
  documentId: "doc-1",
  content: "Rewrite the background section",
  additionalDocumentIds: [],
  responseType: "edit",
};

const singleProposalAiResponse = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          proposals: [
            {
              heading: "Background",
              headingLevel: 2,
              newMarkdown: "## Background\n\nUpdated background content.",
              isNew: false,
            },
          ],
        }),
      },
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue(authed);
  mockDocFindFirst.mockResolvedValue(existingDocument);
  (prisma.document.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.document.findUnique as jest.Mock).mockResolvedValue(null);
  mockUserFindUnique.mockResolvedValue({ openRouterKey: "encrypted-key", explicitEnabled: false });
  mockChatFindMany.mockResolvedValue([]);
  mockChatCount.mockResolvedValue(2);
  mockChatCreateMany.mockResolvedValue({ count: 2 });
  (prisma.$transaction as jest.Mock).mockResolvedValue([]);
  mockFetch.mockResolvedValue(makeSseStream("Hello!"));
});

describe("POST /api/ai/collab — auth & validation", () => {
  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest(chatBody));
    expect(res.status).toBe(401);
  });

  test("returns 404 when document not found or not owned", async () => {
    mockDocFindFirst.mockResolvedValue(null);
    const res = await POST(makeRequest(chatBody));
    expect(res.status).toBe(404);
  });

  test("returns 402 when no AI provider configured", async () => {
    mockUserFindUnique.mockResolvedValue({ openRouterKey: null });
    const res = await POST(makeRequest(chatBody));
    expect(res.status).toBe(402);
  });

  test("returns 400 when responseType is missing", async () => {
    const res = await POST(
      makeRequest({ documentId: "doc-1", content: "Hello", additionalDocumentIds: [] }),
    );
    expect(res.status).toBe(400);
  });

  test("returns 400 when responseType is invalid", async () => {
    const res = await POST(
      makeRequest({ documentId: "doc-1", content: "Hello", additionalDocumentIds: [], responseType: "analyze" }),
    );
    expect(res.status).toBe(400);
  });

  test("returns 400 when additionalDocumentIds is missing", async () => {
    const res = await POST(
      makeRequest({ documentId: "doc-1", content: "Hello", responseType: "chat" }),
    );
    expect(res.status).toBe(400);
  });

  test("returns 400 when content is missing", async () => {
    const res = await POST(
      makeRequest({ documentId: "doc-1", additionalDocumentIds: [], responseType: "chat" }),
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/ai/collab — responseType: chat", () => {
  test("streams SSE with Content-Type text/event-stream", async () => {
    const res = await POST(makeRequest(chatBody));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
  });

  test("persists user and assistant ChatMessage rows", async () => {
    const res = await POST(makeRequest(chatBody));
    // Drain stream so persistence runs
    await res.text();
    expect(mockChatCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ role: "user", content: chatBody.content }),
          expect.objectContaining({ role: "assistant" }),
        ]),
      }),
    );
  });

  test("does not call OpenRouter when API key is absent", async () => {
    mockUserFindUnique.mockResolvedValue({ openRouterKey: null });
    await POST(makeRequest(chatBody));
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("POST /api/ai/collab — responseType: edit", () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue(makeJsonResponse(singleProposalAiResponse));
  });

  test("returns JSON with proposals array", async () => {
    const res = await POST(makeRequest(editBody));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { proposals: unknown[] };
    expect(Array.isArray(body.proposals)).toBe(true);
    expect(body.proposals).toHaveLength(1);
  });

  test("proposals include id, heading, newMarkdown, beforeMarkdown, isNew", async () => {
    const res = await POST(makeRequest(editBody));
    const body = (await res.json()) as {
      proposals: Array<{
        id: string;
        heading: string;
        newMarkdown: string;
        beforeMarkdown: string;
        isNew: boolean;
      }>;
    };
    const [proposal] = body.proposals;
    expect(typeof proposal.id).toBe("string");
    expect(proposal.heading).toBe("Background");
    expect(proposal.newMarkdown).toContain("## Background");
    expect(proposal.beforeMarkdown).toContain("Original content.");
    expect(proposal.isNew).toBe(false);
  });

  test("does not return SSE stream for edit response", async () => {
    const res = await POST(makeRequest(editBody));
    expect(res.headers.get("Content-Type")).not.toContain("text/event-stream");
  });

  test("does not persist ChatMessage rows for edit response", async () => {
    const res = await POST(makeRequest(editBody));
    await res.json();
    expect(mockChatCreateMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/ai/collab — additional context docs", () => {
  beforeEach(() => {
    // First findFirst call = primary doc; subsequent = context docs
    mockDocFindFirst
      .mockResolvedValueOnce(existingDocument)
      .mockResolvedValueOnce(contextDocument);
  });

  test("additional docs owned by user are injected into system prompt (chat)", async () => {
    const res = await POST(
      makeRequest({ ...chatBody, additionalDocumentIds: ["doc-2"] }),
    );
    await res.text();

    const fetchBody = JSON.parse(
      (mockFetch.mock.calls[0] as [string, { body: string }])[1].body,
    ) as { messages: Array<{ role: string; content: string }> };

    const systemMessage = fetchBody.messages.find((m) => m.role === "system");
    expect(systemMessage?.content).toContain("Additional context documents");
    expect(systemMessage?.content).toContain("A peaceful place.");
  });

  test("additional docs owned by user are injected into user message (edit)", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse(singleProposalAiResponse));

    const res = await POST(
      makeRequest({ ...editBody, additionalDocumentIds: ["doc-2"] }),
    );
    await res.json();

    const fetchBody = JSON.parse(
      (mockFetch.mock.calls[0] as [string, { body: string }])[1].body,
    ) as { messages: Array<{ role: string; content: string }> };

    const userMessage = fetchBody.messages.find((m) => m.role === "user");
    expect(userMessage?.content).toContain("Additional context documents");
    expect(userMessage?.content).toContain("A peaceful place.");
  });

  test("additional docs belonging to another user are excluded", async () => {
    const otherUserDoc = { ...contextDocument, story: { userId: "other-user", mode: "ORIGINAL", rating: "T" } };
    mockDocFindFirst
      .mockReset()
      .mockResolvedValueOnce(existingDocument)
      .mockResolvedValueOnce(otherUserDoc);

    const res = await POST(
      makeRequest({ ...chatBody, additionalDocumentIds: ["doc-2"] }),
    );
    await res.text();

    const fetchBody = JSON.parse(
      (mockFetch.mock.calls[0] as [string, { body: string }])[1].body,
    ) as { messages: Array<{ role: string; content: string }> };

    const systemMessage = fetchBody.messages.find((m) => m.role === "system");
    expect(systemMessage?.content).not.toContain("A peaceful place.");
  });
});
