jest.mock("@/auth", () => ({
  auth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    document: { findMany: jest.fn() },
    story: { findFirst: jest.fn() },
    series: { findFirst: jest.fn() },
    universe: { findFirst: jest.fn() },
  },
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/documents/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = auth as jest.Mock;
const mockDocFindMany = prisma.document.findMany as jest.Mock;
const mockStoryFindFirst = prisma.story.findFirst as jest.Mock;

const authed = { user: { id: "user-1" } };

function makeGetRequest(url: string): NextRequest {
  return new NextRequest(url, { method: "GET" });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue(authed);
  mockStoryFindFirst.mockResolvedValue({ id: "story-1", userId: "user-1" });
  mockDocFindMany.mockResolvedValue([]);
});

// ── CHARACTER doc links query ─────────────────────────────────────────────────
// The links bar fetches types=RELATIONSHIP,CHARACTER so it can resolve both
// the relationship doc and the "other" character's name.

describe("Document links bar — CHARACTER doc query (types=RELATIONSHIP,CHARACTER)", () => {
  test("returns 200 and passes correct type filter to Prisma", async () => {
    const char = { id: "char-1", name: "Aragorn", type: "CHARACTER", meta: null };
    const rel = {
      id: "rel-1",
      name: "Rivals",
      type: "RELATIONSHIP",
      meta: { characterIds: ["char-1", "char-2"] },
    };
    mockDocFindMany.mockResolvedValue([char, rel]);

    const res = await GET(
      makeGetRequest(
        "http://localhost/api/documents?storyId=story-1&types=RELATIONSHIP,CHARACTER",
      ),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; type: string }[];
    expect(body).toHaveLength(2);
    expect(body.map((d) => d.type).sort()).toEqual(["CHARACTER", "RELATIONSHIP"]);

    const findManyCall = mockDocFindMany.mock.calls[0][0] as {
      where: { type?: { in: string[] } };
    };
    expect(findManyCall.where.type).toEqual({
      in: expect.arrayContaining(["CHARACTER", "RELATIONSHIP"]),
    });
  });

  test("does not return PLOT documents even if they exist in the story", async () => {
    mockDocFindMany.mockResolvedValue([
      { id: "char-1", name: "Aragorn", type: "CHARACTER", meta: null },
    ]);

    const res = await GET(
      makeGetRequest(
        "http://localhost/api/documents?storyId=story-1&types=RELATIONSHIP,CHARACTER",
      ),
    );
    const body = (await res.json()) as { type: string }[];
    expect(body.every((d) => d.type !== "PLOT")).toBe(true);

    const findManyCall = mockDocFindMany.mock.calls[0][0] as {
      where: { type?: { in: string[] } };
    };
    expect(findManyCall.where.type?.in).not.toContain("PLOT");
  });

  test("returns empty array when no relationships reference this character", async () => {
    mockDocFindMany.mockResolvedValue([]);

    const res = await GET(
      makeGetRequest(
        "http://localhost/api/documents?storyId=story-1&types=RELATIONSHIP,CHARACTER",
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body).toHaveLength(0);
  });
});

// ── RELATIONSHIP doc links query ──────────────────────────────────────────────
// The links bar fetches types=CHARACTER to display both linked character docs.

describe("Document links bar — RELATIONSHIP doc query (types=CHARACTER)", () => {
  test("returns 200 and passes correct type filter to Prisma", async () => {
    const char1 = { id: "char-1", name: "Aragorn", type: "CHARACTER", meta: null };
    const char2 = { id: "char-2", name: "Boromir", type: "CHARACTER", meta: null };
    mockDocFindMany.mockResolvedValue([char1, char2]);

    const res = await GET(
      makeGetRequest("http://localhost/api/documents?storyId=story-1&types=CHARACTER"),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; type: string }[];
    expect(body).toHaveLength(2);
    expect(body.every((d) => d.type === "CHARACTER")).toBe(true);

    const findManyCall = mockDocFindMany.mock.calls[0][0] as {
      where: { type?: { in: string[] } };
    };
    expect(findManyCall.where.type).toEqual({ in: ["CHARACTER"] });
  });

  test("returns both linked character docs when both exist in the story", async () => {
    const char1 = { id: "char-1", name: "Aragorn", type: "CHARACTER", meta: null };
    const char2 = { id: "char-2", name: "Boromir", type: "CHARACTER", meta: null };
    mockDocFindMany.mockResolvedValue([char1, char2]);

    const res = await GET(
      makeGetRequest("http://localhost/api/documents?storyId=story-1&types=CHARACTER"),
    );
    const body = (await res.json()) as { id: string }[];
    const ids = body.map((d) => d.id);
    expect(ids).toContain("char-1");
    expect(ids).toContain("char-2");
  });
});

// ── Non-linking doc types ─────────────────────────────────────────────────────
// PLOT, SCENE, WORLDBUILDING, and OTHER documents don't trigger any fetch in the
// links bar component, but if the endpoint is called with those types, it should
// filter correctly rather than return everything.

describe("Document links bar — non-linking doc types", () => {
  test("types=PLOT returns only PLOT documents", async () => {
    const plot = { id: "plot-1", name: "The Journey", type: "PLOT", meta: null };
    mockDocFindMany.mockResolvedValue([plot]);

    const res = await GET(
      makeGetRequest("http://localhost/api/documents?storyId=story-1&types=PLOT"),
    );
    expect(res.status).toBe(200);

    const findManyCall = mockDocFindMany.mock.calls[0][0] as {
      where: { type?: { in: string[] } };
    };
    expect(findManyCall.where.type).toEqual({ in: ["PLOT"] });
  });

  test("invalid/unknown types are stripped; all documents returned when no valid types remain", async () => {
    const res = await GET(
      makeGetRequest("http://localhost/api/documents?storyId=story-1&types=INVALID"),
    );
    expect(res.status).toBe(200);

    const findManyCall = mockDocFindMany.mock.calls[0][0] as {
      where: { type?: { in: string[] } };
    };
    // All invalid types are stripped, so no type filter is applied
    expect(findManyCall.where.type).toBeUndefined();
  });
});
