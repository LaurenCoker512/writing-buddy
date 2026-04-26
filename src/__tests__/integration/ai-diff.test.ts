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
import { POST } from "@/app/api/ai/diff/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = auth as jest.Mock;
const mockDocFindFirst = prisma.document.findFirst as jest.Mock;
const mockUserFindUnique = prisma.user.findUnique as jest.Mock;

const authed = { user: { id: "user-1" } };

const existingDocument = {
  id: "doc-1",
  tiptapJson: {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Background" }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Original content." }],
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
  return new NextRequest("http://localhost/api/ai/diff", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const singleProposalResponse = {
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
  mockUserFindUnique.mockResolvedValue({ openRouterKey: "encrypted-key" });
  mockFetch.mockResolvedValue(makeJsonResponse(singleProposalResponse));
});

describe("POST /api/ai/diff", () => {
  test("returns structured diff proposals from mock OpenRouter", async () => {
    const res = await POST(makeRequest({ documentId: "doc-1", instruction: "Improve the background" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { proposals: unknown[] };
    expect(Array.isArray(body.proposals)).toBe(true);
    expect(body.proposals).toHaveLength(1);
  });

  test("each proposal includes id, heading, newMarkdown, isNew", async () => {
    const res = await POST(makeRequest({ documentId: "doc-1", instruction: "Edit it" }));
    const body = (await res.json()) as {
      proposals: Array<{
        id: string;
        heading: string;
        newMarkdown: string;
        isNew: boolean;
      }>;
    };
    const [proposal] = body.proposals;
    expect(typeof proposal.id).toBe("string");
    expect(proposal.id.length).toBeGreaterThan(0);
    expect(proposal.heading).toBe("Background");
    expect(proposal.newMarkdown).toContain("## Background");
    expect(proposal.isNew).toBe(false);
  });

  test("enriches proposals with beforeMarkdown extracted from current document", async () => {
    const res = await POST(makeRequest({ documentId: "doc-1", instruction: "Edit it" }));
    const body = (await res.json()) as { proposals: Array<{ beforeMarkdown: string }> };
    expect(body.proposals[0].beforeMarkdown).toContain("## Background");
    expect(body.proposals[0].beforeMarkdown).toContain("Original content.");
  });

  test("marks proposals with null heading as isNew: true", async () => {
    mockFetch.mockResolvedValueOnce(
      makeJsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                proposals: [
                  {
                    heading: null,
                    headingLevel: 2,
                    newMarkdown: "## New Section\n\nNew content.",
                    isNew: true,
                  },
                ],
              }),
            },
          },
        ],
      }),
    );

    const res = await POST(makeRequest({ documentId: "doc-1", instruction: "Add a new section" }));
    const body = (await res.json()) as { proposals: Array<{ isNew: boolean; heading: null; beforeMarkdown: string }> };
    expect(body.proposals[0].isNew).toBe(true);
    expect(body.proposals[0].heading).toBeNull();
    expect(body.proposals[0].beforeMarkdown).toBe("");
  });

  test("returns 402 with no_api_key error when key is absent", async () => {
    mockUserFindUnique.mockResolvedValue({ openRouterKey: null });
    const res = await POST(makeRequest({ documentId: "doc-1", instruction: "Edit it" }));
    expect(res.status).toBe(402);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("no_api_key");
  });

  test("does not call OpenRouter when API key is absent", async () => {
    mockUserFindUnique.mockResolvedValue({ openRouterKey: null });
    await POST(makeRequest({ documentId: "doc-1", instruction: "Edit it" }));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ documentId: "doc-1", instruction: "Edit it" }));
    expect(res.status).toBe(401);
  });

  test("returns 404 when document not found or not owned", async () => {
    mockDocFindFirst.mockResolvedValue(null);
    const res = await POST(makeRequest({ documentId: "doc-1", instruction: "Edit it" }));
    expect(res.status).toBe(404);
  });

  test("returns 400 when instruction is missing", async () => {
    const res = await POST(makeRequest({ documentId: "doc-1" }));
    expect(res.status).toBe(400);
  });

  test("returns 400 when documentId is missing", async () => {
    const res = await POST(makeRequest({ instruction: "Edit it" }));
    expect(res.status).toBe(400);
  });
});
