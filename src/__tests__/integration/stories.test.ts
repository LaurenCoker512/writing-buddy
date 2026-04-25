jest.mock("@/auth", () => ({
  auth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    story: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/stories/route";
import {
  GET as GET_ONE,
  PATCH,
  DELETE,
} from "@/app/api/stories/[id]/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = auth as jest.Mock;
const mockFindMany = prisma.story.findMany as jest.Mock;
const mockFindFirst = prisma.story.findFirst as jest.Mock;
const mockCreate = prisma.story.create as jest.Mock;
const mockDelete = prisma.story.delete as jest.Mock;

const authed = { user: { id: "user-1" } };
const PARAMS = { params: { id: "story-1" } };

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/stories", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const existingStory = {
  id: "story-1",
  userId: "user-1",
  universeId: null,
  seriesId: null,
  name: "A New Story",
  mode: "ORIGINAL",
  rating: "G",
  sourceTitle: null,
  createdAt: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue(authed);
  mockFindFirst.mockResolvedValue(existingStory);
  mockCreate.mockResolvedValue(existingStory);
  mockDelete.mockResolvedValue(existingStory);
  mockFindMany.mockResolvedValue([existingStory]);
  (prisma.story.update as jest.Mock).mockResolvedValue(existingStory);
});

describe("POST /api/stories", () => {
  test("creates standalone story with correct fields and returns 201", async () => {
    const body = { name: "A New Story", mode: "ORIGINAL", rating: "G" };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(201);

    const createCall = mockCreate.mock.calls[0][0] as {
      data: {
        userId: string;
        name: string;
        mode: string;
        rating: string;
        seriesId: null;
        universeId: null;
      };
    };
    expect(createCall.data.userId).toBe("user-1");
    expect(createCall.data.name).toBe("A New Story");
    expect(createCall.data.seriesId).toBeNull();
    expect(createCall.data.universeId).toBeNull();
  });

  test("creates story with optional seriesId (no universeId)", async () => {
    const body = {
      name: "Chapter Story",
      mode: "ORIGINAL",
      rating: "T",
      seriesId: "series-abc",
    };
    await POST(makeRequest(body));
    const createCall = mockCreate.mock.calls[0][0] as {
      data: { seriesId: string; universeId: null };
    };
    expect(createCall.data.seriesId).toBe("series-abc");
    expect(createCall.data.universeId).toBeNull();
  });

  test("creates story with optional universeId", async () => {
    const body = {
      name: "Universe Story",
      mode: "ORIGINAL",
      rating: "M",
      universeId: "universe-abc",
    };
    await POST(makeRequest(body));
    const createCall = mockCreate.mock.calls[0][0] as {
      data: { universeId: string };
    };
    expect(createCall.data.universeId).toBe("universe-abc");
  });

  test("creates story with full hierarchy chain (seriesId + universeId)", async () => {
    const body = {
      name: "Full Chain Story",
      mode: "ORIGINAL",
      rating: "G",
      seriesId: "series-abc",
      universeId: "universe-abc",
    };
    await POST(makeRequest(body));
    const createCall = mockCreate.mock.calls[0][0] as {
      data: { seriesId: string; universeId: string };
    };
    expect(createCall.data.seriesId).toBe("series-abc");
    expect(createCall.data.universeId).toBe("universe-abc");
  });

  test("returns 400 when name is missing", async () => {
    const res = await POST(makeRequest({ mode: "ORIGINAL", rating: "G" }));
    expect(res.status).toBe(400);
  });

  test("returns 400 for invalid mode", async () => {
    const res = await POST(makeRequest({ name: "Test", mode: "WRONG", rating: "G" }));
    expect(res.status).toBe(400);
  });

  test("returns 400 for invalid rating", async () => {
    const res = await POST(makeRequest({ name: "Test", mode: "ORIGINAL", rating: "Z" }));
    expect(res.status).toBe(400);
  });

  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ name: "Test", mode: "ORIGINAL", rating: "G" }));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/stories", () => {
  test("returns list for authenticated user", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
    );
  });

  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe("GET /api/stories/[id]", () => {
  test("returns story for authenticated owner", async () => {
    const res = await GET_ONE(makeRequest(), PARAMS);
    expect(res.status).toBe(200);
  });

  test("returns 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    const res = await GET_ONE(makeRequest(), PARAMS);
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/stories/[id]", () => {
  test("renames story", async () => {
    const req = new NextRequest("http://localhost/api/stories/story-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "New Title" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, PARAMS);
    expect(res.status).toBe(200);
  });

  test("returns 404 when story not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    const req = new NextRequest("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ name: "New" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, PARAMS);
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/stories/[id]", () => {
  test("deletes story and returns 204", async () => {
    const res = await DELETE(makeRequest(), PARAMS);
    expect(res.status).toBe(204);
    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "story-1" } })
    );
  });

  test("returns 404 when story not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    const res = await DELETE(makeRequest(), PARAMS);
    expect(res.status).toBe(404);
  });

  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await DELETE(makeRequest(), PARAMS);
    expect(res.status).toBe(401);
  });
});
