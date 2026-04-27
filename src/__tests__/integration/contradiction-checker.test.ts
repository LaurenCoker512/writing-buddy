jest.mock("@/auth", () => ({ auth: jest.fn() }));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    story: { findFirst: jest.fn() },
    document: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));

jest.mock("@/lib/encryption", () => ({
  decryptApiKey: jest.fn().mockReturnValue("plaintext-api-key"),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

import { NextRequest } from "next/server";
import { POST } from "@/app/api/ai/contradiction-check/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ContradictionIssue } from "@/app/api/ai/contradiction-check/route";

const mockAuth = auth as jest.Mock;
const mockStoryFindFirst = prisma.story.findFirst as jest.Mock;
const mockDocumentFindMany = prisma.document.findMany as jest.Mock;
const mockUserFindUnique = prisma.user.findUnique as jest.Mock;

const authed = { user: { id: "user-1" } };

const sampleDocs = [
  {
    id: "doc-1",
    name: "Aria",
    type: "CHARACTER",
    tiptapJson: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "A brave warrior." }] }],
    },
    contentSummary: "Aria is a brave warrior.",
  },
  {
    id: "doc-2",
    name: "Chapter 1",
    type: "PLOT",
    tiptapJson: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Aria is a timid scholar." }] }],
    },
    contentSummary: null,
  },
];

const sampleIssues: ContradictionIssue[] = [
  {
    description: "Aria is described as a warrior in her character sheet but a timid scholar in Chapter 1.",
    documentsInvolved: ["Aria", "Chapter 1"],
    suggestedResolution: "Clarify Aria's background — choose one consistent description.",
  },
];

function makeOpenRouterResponse(content: unknown): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ai/contradiction-check", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue(authed);
  mockStoryFindFirst.mockResolvedValue({ id: "story-1" });
  mockDocumentFindMany.mockResolvedValue(sampleDocs);
  mockUserFindUnique.mockResolvedValue({ openRouterKey: "encrypted-key" });
  mockFetch.mockResolvedValue(makeOpenRouterResponse({ issues: sampleIssues }));
});

describe("POST /api/ai/contradiction-check", () => {
  test("returns structured issues from OpenRouter", async () => {
    const res = await POST(makeRequest({ storyId: "story-1" }));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { issues: ContradictionIssue[]; tokenEstimate: number };
    expect(Array.isArray(body.issues)).toBe(true);
    expect(body.issues).toHaveLength(1);
    expect(body.issues[0].description).toBe(sampleIssues[0].description);
    expect(body.issues[0].documentsInvolved).toEqual(["Aria", "Chapter 1"]);
    expect(typeof body.tokenEstimate).toBe("number");
    expect(body.tokenEstimate).toBeGreaterThan(0);
  });

  test("returns tokenEstimate only when estimateOnly is true — does not call OpenRouter", async () => {
    const res = await POST(makeRequest({ storyId: "story-1", estimateOnly: true }));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { tokenEstimate: number };
    expect(body.tokenEstimate).toBeGreaterThan(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("returns empty issues array when AI finds no contradictions", async () => {
    mockFetch.mockResolvedValue(makeOpenRouterResponse({ issues: [] }));
    const res = await POST(makeRequest({ storyId: "story-1" }));

    const body = (await res.json()) as { issues: ContradictionIssue[] };
    expect(body.issues).toHaveLength(0);
  });

  test("calls OpenRouter with correct authorization header", async () => {
    await POST(makeRequest({ storyId: "story-1" }));
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("openrouter.ai"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer plaintext-api-key" }),
      }),
    );
  });

  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ storyId: "story-1" }));
    expect(res.status).toBe(401);
  });

  test("returns 400 when storyId is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  test("returns 400 when storyId is not a string", async () => {
    const res = await POST(makeRequest({ storyId: 42 }));
    expect(res.status).toBe(400);
  });

  test("returns 404 when story is not owned by user", async () => {
    mockStoryFindFirst.mockResolvedValue(null);
    const res = await POST(makeRequest({ storyId: "story-1" }));
    expect(res.status).toBe(404);
  });

  test("returns 402 with no_api_key error when key is absent", async () => {
    mockUserFindUnique.mockResolvedValue({ openRouterKey: null });
    const res = await POST(makeRequest({ storyId: "story-1" }));
    expect(res.status).toBe(402);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("no_api_key");
  });

  test("does not call OpenRouter when API key is absent", async () => {
    mockUserFindUnique.mockResolvedValue({ openRouterKey: null });
    await POST(makeRequest({ storyId: "story-1" }));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("filters out issues with missing description or suggestedResolution", async () => {
    mockFetch.mockResolvedValue(
      makeOpenRouterResponse({
        issues: [
          { description: "Valid issue", documentsInvolved: ["Doc A"], suggestedResolution: "Fix it." },
          { description: null, documentsInvolved: [], suggestedResolution: "No description." },
          { description: "No resolution", documentsInvolved: [], suggestedResolution: null },
        ],
      }),
    );
    const res = await POST(makeRequest({ storyId: "story-1" }));
    const body = (await res.json()) as { issues: ContradictionIssue[] };
    expect(body.issues).toHaveLength(1);
    expect(body.issues[0].description).toBe("Valid issue");
  });
});
