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
import { POST } from "@/app/api/ai/analyze/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AI_CONFIG } from "@/config/ai";

const mockAuth = auth as jest.Mock;
const mockDocFindFirst = prisma.document.findFirst as jest.Mock;
const mockUserFindUnique = prisma.user.findUnique as jest.Mock;

const authed = { user: { id: "user-1" } };

const characterDocument = {
  id: "doc-1",
  type: "CHARACTER",
  tiptapJson: {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Personality" }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Existing personality notes." }],
      },
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

function makeJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ai/analyze", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const singleSectionResponse = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          sections: [
            {
              heading: "Personality",
              content: "- Sarcastic and deflects with humor\n- Shows vulnerability when pressed",
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
  mockDocFindFirst.mockResolvedValue(characterDocument);
  mockUserFindUnique.mockResolvedValue({ openRouterKey: "encrypted-key" });
  mockFetch.mockResolvedValue(makeJsonResponse(singleSectionResponse));
});

describe("POST /api/ai/analyze", () => {
  test("returns organized sections from mock OpenRouter", async () => {
    const res = await POST(
      makeRequest({ documentId: "doc-1", content: "She rolled her eyes and laughed it off." }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sections: unknown[] };
    expect(Array.isArray(body.sections)).toBe(true);
    expect(body.sections).toHaveLength(1);
  });

  test("each section has heading and content", async () => {
    const res = await POST(
      makeRequest({ documentId: "doc-1", content: "She rolled her eyes and laughed it off." }),
    );
    const body = (await res.json()) as {
      sections: Array<{ heading: string; content: string }>;
    };
    const [section] = body.sections;
    expect(section.heading).toBe("Personality");
    expect(section.content).toContain("Sarcastic");
    expect(section.content).toContain("- ");
  });

  test("system prompt includes document-type and type-specific extraction focus", async () => {
    await POST(
      makeRequest({ documentId: "doc-1", content: "She rolled her eyes and laughed it off." }),
    );
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string) as {
      messages: Array<{ role: string; content: string }>;
    };
    const systemMessage = callBody.messages.find((m) => m.role === "system");
    expect(systemMessage).toBeDefined();
    expect(systemMessage!.content).toContain("CHARACTER");
    expect(systemMessage!.content).toContain("personality traits");
  });

  test("filters out sections with empty heading or content", async () => {
    mockFetch.mockResolvedValueOnce(
      makeJsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                sections: [
                  { heading: "Personality", content: "- Sarcastic" },
                  { heading: "", content: "should be filtered" },
                  { heading: "Backstory", content: "" },
                ],
              }),
            },
          },
        ],
      }),
    );

    const res = await POST(makeRequest({ documentId: "doc-1", content: "Some scene text." }));
    const body = (await res.json()) as { sections: Array<{ heading: string }> };
    expect(body.sections).toHaveLength(1);
    expect(body.sections[0].heading).toBe("Personality");
  });

  test("returns 400 when content exceeds MAX_SOURCE_TEXT_LENGTH", async () => {
    const longContent = "a".repeat(AI_CONFIG.MAX_SOURCE_TEXT_LENGTH + 1);
    const res = await POST(makeRequest({ documentId: "doc-1", content: longContent }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Content too long");
  });

  test("returns 402 with no_api_key error when key is absent", async () => {
    mockUserFindUnique.mockResolvedValue({ openRouterKey: null });
    const res = await POST(makeRequest({ documentId: "doc-1", content: "Some scene text." }));
    expect(res.status).toBe(402);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("no_api_key");
  });

  test("does not call OpenRouter when API key is absent", async () => {
    mockUserFindUnique.mockResolvedValue({ openRouterKey: null });
    await POST(makeRequest({ documentId: "doc-1", content: "Some scene text." }));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ documentId: "doc-1", content: "Some scene text." }));
    expect(res.status).toBe(401);
  });

  test("returns 404 when document not found or not owned", async () => {
    mockDocFindFirst.mockResolvedValue(null);
    const res = await POST(makeRequest({ documentId: "doc-1", content: "Some scene text." }));
    expect(res.status).toBe(404);
  });

  test("returns 400 when content is missing", async () => {
    const res = await POST(makeRequest({ documentId: "doc-1" }));
    expect(res.status).toBe(400);
  });

  test("returns 400 when documentId is missing", async () => {
    const res = await POST(makeRequest({ content: "Some scene text." }));
    expect(res.status).toBe(400);
  });
});
