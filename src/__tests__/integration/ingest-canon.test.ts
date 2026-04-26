jest.mock("@/auth", () => ({ auth: jest.fn() }));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    universe: { findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
    document: { findFirst: jest.fn(), update: jest.fn() },
  },
}));

jest.mock("@/lib/encryption", () => ({
  decryptApiKey: jest.fn().mockReturnValue("plaintext-api-key"),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

import { NextRequest } from "next/server";
import { POST as ingestCanonPost } from "@/app/api/ai/ingest-canon/route";
import { PATCH as documentPatch } from "@/app/api/documents/[id]/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = auth as jest.Mock;
const mockUniverseFindFirst = prisma.universe.findFirst as jest.Mock;
const mockUserFindUnique = prisma.user.findUnique as jest.Mock;
const mockDocumentFindFirst = prisma.document.findFirst as jest.Mock;
const mockDocumentUpdate = prisma.document.update as jest.Mock;

const authed = { user: { id: "user-1" } };

function makeJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function makeIngestRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ai/ingest-canon", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeDocumentPatchRequest(id: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/documents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const canonProposalResponse = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          proposals: [
            {
              documentName: "Hermione Granger",
              documentType: "CHARACTER",
              markdown: "## Overview\n\nBrilliant witch and one of Harry's best friends.",
            },
            {
              documentName: "Hogwarts School",
              documentType: "WORLDBUILDING",
              markdown: "## Overview\n\nSchool of witchcraft and wizardry.",
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
  mockUniverseFindFirst.mockResolvedValue({ id: "universe-1", userId: "user-1", name: "Wizarding World" });
  mockUserFindUnique.mockResolvedValue({ openRouterKey: "encrypted-key" });
  mockFetch.mockResolvedValue(makeJsonResponse(canonProposalResponse));
});

describe("POST /api/ai/ingest-canon", () => {
  test("returns diff proposals for CHARACTER and WORLDBUILDING documents with mock OpenRouter", async () => {
    const res = await ingestCanonPost(
      makeIngestRequest({ universeId: "universe-1", sourceText: "Harry Potter wiki text..." }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { proposals: unknown[] };
    expect(Array.isArray(body.proposals)).toBe(true);
    expect(body.proposals).toHaveLength(2);
  });

  test("proposals include documentName, documentType, markdown, and id", async () => {
    const res = await ingestCanonPost(
      makeIngestRequest({ universeId: "universe-1", sourceText: "Source text" }),
    );
    const body = (await res.json()) as {
      proposals: Array<{
        id: string;
        documentName: string;
        documentType: string;
        markdown: string;
      }>;
    };
    const [char, world] = body.proposals;
    expect(typeof char.id).toBe("string");
    expect(char.id.length).toBeGreaterThan(0);
    expect(char.documentName).toBe("Hermione Granger");
    expect(char.documentType).toBe("CHARACTER");
    expect(char.markdown).toContain("## Overview");
    expect(world.documentType).toBe("WORLDBUILDING");
    expect(world.documentName).toBe("Hogwarts School");
  });

  test("filters out proposals with invalid documentType", async () => {
    mockFetch.mockResolvedValueOnce(
      makeJsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                proposals: [
                  { documentName: "Valid", documentType: "CHARACTER", markdown: "## Overview\n\nContent." },
                  { documentName: "Invalid", documentType: "SCENE", markdown: "## Overview\n\nContent." },
                ],
              }),
            },
          },
        ],
      }),
    );
    const res = await ingestCanonPost(
      makeIngestRequest({ universeId: "universe-1", sourceText: "Source text" }),
    );
    const body = (await res.json()) as { proposals: unknown[] };
    expect(body.proposals).toHaveLength(1);
  });

  test("returns 402 when API key is absent", async () => {
    mockUserFindUnique.mockResolvedValue({ openRouterKey: null });
    const res = await ingestCanonPost(
      makeIngestRequest({ universeId: "universe-1", sourceText: "Source text" }),
    );
    expect(res.status).toBe(402);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("no_api_key");
  });

  test("returns 404 when universe is not found or not owned", async () => {
    mockUniverseFindFirst.mockResolvedValue(null);
    const res = await ingestCanonPost(
      makeIngestRequest({ universeId: "universe-1", sourceText: "Source text" }),
    );
    expect(res.status).toBe(404);
  });

  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await ingestCanonPost(
      makeIngestRequest({ universeId: "universe-1", sourceText: "Source text" }),
    );
    expect(res.status).toBe(401);
  });

  test("returns 400 when sourceText is missing", async () => {
    const res = await ingestCanonPost(makeIngestRequest({ universeId: "universe-1" }));
    expect(res.status).toBe(400);
  });

  test("returns 400 when sourceText is empty", async () => {
    const res = await ingestCanonPost(
      makeIngestRequest({ universeId: "universe-1", sourceText: "   " }),
    );
    expect(res.status).toBe(400);
  });

  test("does not call OpenRouter when API key is absent", async () => {
    mockUserFindUnique.mockResolvedValue({ openRouterKey: null });
    await ingestCanonPost(
      makeIngestRequest({ universeId: "universe-1", sourceText: "Source text" }),
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/documents/[id] — meta.isCanon", () => {
  const existingDocument = {
    id: "doc-1",
    type: "CHARACTER",
    name: "Test Character",
    tiptapJson: { type: "doc", content: [] },
    meta: null,
    storyId: null,
    seriesId: null,
    universeId: "universe-1",
    parentDocumentId: null,
    story: null,
    series: null,
    universe: { userId: "user-1" },
    contentSummaryGeneratedAt: null,
  };

  beforeEach(() => {
    mockDocumentFindFirst.mockResolvedValue(existingDocument);
    mockDocumentUpdate.mockResolvedValue({ ...existingDocument, meta: { isCanon: true } });
  });

  test("stores meta.isCanon = true and returns it in the response", async () => {
    const res = await documentPatch(
      makeDocumentPatchRequest("doc-1", { meta: { isCanon: true } }),
      { params: { id: "doc-1" } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { meta: { isCanon: boolean } };
    expect(body.meta.isCanon).toBe(true);
  });

  test("PATCH calls update with correct meta payload", async () => {
    await documentPatch(
      makeDocumentPatchRequest("doc-1", { meta: { isCanon: true } }),
      { params: { id: "doc-1" } },
    );
    expect(mockDocumentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ meta: { isCanon: true } }),
      }),
    );
  });
});
