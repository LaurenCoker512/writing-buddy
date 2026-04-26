jest.mock("@/auth", () => ({ auth: jest.fn() }));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    document: { findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
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

const mockAuth = auth as jest.Mock;
const mockDocFindFirst = prisma.document.findFirst as jest.Mock;
const mockUserFindUnique = prisma.user.findUnique as jest.Mock;

const authed = { user: { id: "user-1" } };

const existingDocument = {
  id: "doc-1",
  type: "CHARACTER",
  name: "Aragorn",
  tiptapJson: { type: "doc", content: [] },
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
  mockUserFindUnique.mockResolvedValue({ openRouterKey: "encrypted-key" });
  mockFetch.mockResolvedValue(makeSseStream("Hello!"));
});

describe("POST /api/ai/chat", () => {
  test("returns streamed SSE with Content-Type text/event-stream", async () => {
    const res = await POST(
      makeRequest({ documentId: "doc-1", content: "Tell me about this character", messages: [] }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
  });

  test("calls OpenRouter with correct authorization header", async () => {
    await POST(makeRequest({ documentId: "doc-1", content: "Hello", messages: [] }));
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("openrouter.ai"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer plaintext-api-key" }),
      }),
    );
  });

  test("includes system message and user message in OpenRouter request", async () => {
    await POST(makeRequest({ documentId: "doc-1", content: "Hello", messages: [] }));

    const fetchBody = JSON.parse(
      (mockFetch.mock.calls[0] as [string, { body: string }])[1].body,
    ) as { messages: Array<{ role: string; content: string }> };

    expect(fetchBody.messages[0].role).toBe("system");
    expect(fetchBody.messages.at(-1)?.content).toBe("Hello");
  });

  test("includes recent history messages before the user message", async () => {
    const history = [
      { role: "user", content: "Earlier question" },
      { role: "assistant", content: "Earlier answer" },
    ];
    await POST(makeRequest({ documentId: "doc-1", content: "New question", messages: history }));

    const fetchBody = JSON.parse(
      (mockFetch.mock.calls[0] as [string, { body: string }])[1].body,
    ) as { messages: Array<{ role: string; content: string }> };

    const roles = fetchBody.messages.map((m) => m.role);
    expect(roles).toEqual(["system", "user", "assistant", "user"]);
    expect(fetchBody.messages.at(-1)?.content).toBe("New question");
  });

  test("returns 402 with no_api_key error when key is absent", async () => {
    mockUserFindUnique.mockResolvedValue({ openRouterKey: null });
    const res = await POST(makeRequest({ documentId: "doc-1", content: "Hello", messages: [] }));
    expect(res.status).toBe(402);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("no_api_key");
  });

  test("does not call OpenRouter when API key is absent", async () => {
    mockUserFindUnique.mockResolvedValue({ openRouterKey: null });
    await POST(makeRequest({ documentId: "doc-1", content: "Hello", messages: [] }));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ documentId: "doc-1", content: "Hello", messages: [] }));
    expect(res.status).toBe(401);
  });

  test("returns 404 when document is not found or not owned", async () => {
    mockDocFindFirst.mockResolvedValue(null);
    const res = await POST(makeRequest({ documentId: "doc-1", content: "Hello", messages: [] }));
    expect(res.status).toBe(404);
  });

  test("returns 400 when request body is missing required fields", async () => {
    const res = await POST(makeRequest({ documentId: "doc-1" }));
    expect(res.status).toBe(400);
  });
});
