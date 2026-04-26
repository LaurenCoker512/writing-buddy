jest.mock("@/auth", () => ({ auth: jest.fn() }));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
  },
}));

jest.mock("@/lib/encryption", () => ({
  decryptApiKey: jest.fn().mockReturnValue("plaintext-api-key"),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

import { NextRequest } from "next/server";
import { POST } from "@/app/api/brainstorm/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AI_CONFIG } from "@/config/ai";

const mockAuth = auth as jest.Mock;
const mockUserFindUnique = prisma.user.findUnique as jest.Mock;

const authed = { user: { id: "user-1" } };

function makeOpenRouterResponse(loglines: string[]): Response {
  const numbered = loglines.map((l, i) => `${i + 1}. ${l}`).join("\n");
  return new Response(
    JSON.stringify({ choices: [{ message: { content: numbered } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/brainstorm", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const sampleLoglines = Array.from(
  { length: AI_CONFIG.BRAINSTORM_LOGLINE_COUNT },
  (_, i) => `Logline number ${i + 1} about something compelling.`,
);

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue(authed);
  mockUserFindUnique.mockResolvedValue({ openRouterKey: "encrypted-key" });
  mockFetch.mockResolvedValue(makeOpenRouterResponse(sampleLoglines));
});

describe("POST /api/brainstorm", () => {
  test("returns 5 logline strings for ORIGINAL mode", async () => {
    const res = await POST(makeRequest({ mode: "ORIGINAL" }));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { loglines: string[] };
    expect(body.loglines).toHaveLength(AI_CONFIG.BRAINSTORM_LOGLINE_COUNT);
    expect(typeof body.loglines[0]).toBe("string");
  });

  test("returns 5 logline strings for FANFIC mode with source title", async () => {
    const res = await POST(
      makeRequest({ mode: "FANFIC", sourceTitle: "Hamlet" }),
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as { loglines: string[] };
    expect(body.loglines).toHaveLength(AI_CONFIG.BRAINSTORM_LOGLINE_COUNT);
  });

  test("calls OpenRouter with correct authorization header", async () => {
    await POST(makeRequest({ mode: "ORIGINAL" }));
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("openrouter.ai"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer plaintext-api-key" }),
      }),
    );
  });

  test("returns 402 with no_api_key error when key is absent", async () => {
    mockUserFindUnique.mockResolvedValue({ openRouterKey: null });
    const res = await POST(makeRequest({ mode: "ORIGINAL" }));
    expect(res.status).toBe(402);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("no_api_key");
  });

  test("does not call OpenRouter when API key is absent", async () => {
    mockUserFindUnique.mockResolvedValue({ openRouterKey: null });
    await POST(makeRequest({ mode: "ORIGINAL" }));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ mode: "ORIGINAL" }));
    expect(res.status).toBe(401);
  });

  test("returns 400 for invalid mode", async () => {
    const res = await POST(makeRequest({ mode: "INVALID" }));
    expect(res.status).toBe(400);
  });

  test("includes seed text in the prompt sent to OpenRouter", async () => {
    await POST(makeRequest({ mode: "ORIGINAL", seed: "Time travel romance" }));

    const fetchBody = JSON.parse(
      (mockFetch.mock.calls[0] as [string, { body: string }])[1].body,
    ) as { messages: Array<{ role: string; content: string }> };

    expect(fetchBody.messages[0]?.content).toContain("Time travel romance");
  });
});
