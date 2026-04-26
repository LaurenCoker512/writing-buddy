jest.mock("@/auth", () => ({ auth: jest.fn() }));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    savedPrompt: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    story: { create: jest.fn() },
    document: { create: jest.fn() },
  },
}));

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/saved-prompts/route";
import { POST as convertPost } from "@/app/api/saved-prompts/[id]/convert/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = auth as jest.Mock;
const mockFindMany = prisma.savedPrompt.findMany as jest.Mock;
const mockFindUnique = prisma.savedPrompt.findUnique as jest.Mock;
const mockCreate = prisma.savedPrompt.create as jest.Mock;
const mockStoryCreate = prisma.story.create as jest.Mock;
const mockDocCreate = prisma.document.create as jest.Mock;
const mockUpdate = prisma.savedPrompt.update as jest.Mock;

const authed = { user: { id: "user-1" } };

function makeRequest(url: string, body: unknown, method = "POST"): NextRequest {
  return new NextRequest(url, {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue(authed);
});

// ── GET /api/saved-prompts ─────────────────────────────────────────────────────

describe("GET /api/saved-prompts", () => {
  test("returns list of prompts for the authenticated user", async () => {
    const fakePrompts = [{ id: "p1", content: "A logline.", mode: "ORIGINAL" }];
    mockFindMany.mockResolvedValue(fakePrompts);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(fakePrompts);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } }),
    );
  });

  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

// ── POST /api/saved-prompts ────────────────────────────────────────────────────

describe("POST /api/saved-prompts", () => {
  const fakePrompt = { id: "p1", content: "A logline.", mode: "ORIGINAL", sourceTitle: null };

  beforeEach(() => {
    mockCreate.mockResolvedValue(fakePrompt);
  });

  test("creates a SavedPrompt row and returns 201", async () => {
    const res = await POST(
      makeRequest("http://localhost/api/saved-prompts", { content: "A logline.", mode: "ORIGINAL" }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual(fakePrompt);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "user-1", content: "A logline.", mode: "ORIGINAL" }),
      }),
    );
  });

  test("returns 400 when content is missing", async () => {
    const res = await POST(
      makeRequest("http://localhost/api/saved-prompts", { content: "", mode: "ORIGINAL" }),
    );
    expect(res.status).toBe(400);
  });

  test("returns 400 for invalid mode", async () => {
    const res = await POST(
      makeRequest("http://localhost/api/saved-prompts", { content: "A logline.", mode: "INVALID" }),
    );
    expect(res.status).toBe(400);
  });

  test("stores sourceTitle for FANFIC mode", async () => {
    await POST(
      makeRequest("http://localhost/api/saved-prompts", {
        content: "A fanfic logline.",
        mode: "FANFIC",
        sourceTitle: "Harry Potter",
      }),
    );
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sourceTitle: "Harry Potter" }),
      }),
    );
  });

  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(
      makeRequest("http://localhost/api/saved-prompts", { content: "A logline.", mode: "ORIGINAL" }),
    );
    expect(res.status).toBe(401);
  });
});

// ── POST /api/saved-prompts/[id]/convert ──────────────────────────────────────

describe("POST /api/saved-prompts/[id]/convert", () => {
  const savedPrompt = {
    id: "sp-1",
    userId: "user-1",
    content: "A detective discovers a world-ending conspiracy.",
    mode: "ORIGINAL",
    sourceTitle: null,
    convertedToStoryId: null,
  };
  const createdStory = { id: "story-1", name: "Detective Story" };

  beforeEach(() => {
    mockFindUnique.mockResolvedValue(savedPrompt);
    mockStoryCreate.mockResolvedValue(createdStory);
    mockDocCreate.mockResolvedValue({ id: "doc-1" });
    mockUpdate.mockResolvedValue({ ...savedPrompt, convertedToStoryId: "story-1" });
  });

  test("creates Story and Plot document, marks convertedToStoryId, returns 201", async () => {
    const req = makeRequest("http://localhost/api/saved-prompts/sp-1/convert", {
      name: "Detective Story",
      rating: "T",
    });
    const res = await convertPost(req, { params: Promise.resolve({ id: "sp-1" }) });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("story-1");

    expect(mockStoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          name: "Detective Story",
          mode: "ORIGINAL",
          rating: "T",
        }),
      }),
    );

    expect(mockDocCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "PLOT",
          storyId: "story-1",
        }),
      }),
    );

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sp-1" },
        data: { convertedToStoryId: "story-1" },
      }),
    );
  });

  test("Plot document tiptapJson contains logline as Premise content", async () => {
    const req = makeRequest("http://localhost/api/saved-prompts/sp-1/convert", {
      name: "Detective Story",
      rating: "G",
    });
    await convertPost(req, { params: Promise.resolve({ id: "sp-1" }) });

    const docCall = mockDocCreate.mock.calls[0]?.[0] as {
      data: { tiptapJson: { content: Array<{ type: string; content?: Array<{ type: string; text: string }> }> } };
    };
    const content = docCall.data.tiptapJson.content;

    const premiseIdx = content.findIndex(
      (n) => n.type === "heading" && n.content?.[0]?.text === "Premise",
    );
    expect(premiseIdx).toBeGreaterThanOrEqual(0);
    const nextNode = content[premiseIdx + 1];
    expect(nextNode?.type).toBe("paragraph");
    expect(nextNode?.content?.[0]?.text).toBe(savedPrompt.content);
  });

  test("returns 400 when name is missing", async () => {
    const req = makeRequest("http://localhost/api/saved-prompts/sp-1/convert", { rating: "G" });
    const res = await convertPost(req, { params: Promise.resolve({ id: "sp-1" }) });
    expect(res.status).toBe(400);
  });

  test("returns 400 for invalid rating", async () => {
    const req = makeRequest("http://localhost/api/saved-prompts/sp-1/convert", {
      name: "My Story",
      rating: "X",
    });
    const res = await convertPost(req, { params: Promise.resolve({ id: "sp-1" }) });
    expect(res.status).toBe(400);
  });

  test("returns 404 for a prompt that belongs to another user", async () => {
    mockFindUnique.mockResolvedValue({ ...savedPrompt, userId: "other-user" });
    const req = makeRequest("http://localhost/api/saved-prompts/sp-1/convert", {
      name: "My Story",
      rating: "G",
    });
    const res = await convertPost(req, { params: Promise.resolve({ id: "sp-1" }) });
    expect(res.status).toBe(404);
  });

  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const req = makeRequest("http://localhost/api/saved-prompts/sp-1/convert", {
      name: "My Story",
      rating: "G",
    });
    const res = await convertPost(req, { params: Promise.resolve({ id: "sp-1" }) });
    expect(res.status).toBe(401);
  });
});
