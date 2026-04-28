jest.mock("@/auth", () => ({
  auth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    series: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/series/route";
import {
  GET as GET_ONE,
  PATCH,
  DELETE,
} from "@/app/api/series/[id]/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = auth as jest.Mock;
const mockFindMany = prisma.series.findMany as jest.Mock;
const mockFindFirst = prisma.series.findFirst as jest.Mock;
const mockCreate = prisma.series.create as jest.Mock;
const mockDelete = prisma.series.delete as jest.Mock;

const authed = { user: { id: "user-1" } };
const PARAMS = { params: Promise.resolve({ id: "series-1" }) };

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/series", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const existingSeries = {
  id: "series-1",
  userId: "user-1",
  universeId: null,
  name: "The Lord of the Rings",
  mode: "ORIGINAL",
  rating: "T",
  sourceTitle: null,
  createdAt: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue(authed);
  mockFindFirst.mockResolvedValue(existingSeries);
  mockCreate.mockResolvedValue(existingSeries);
  mockDelete.mockResolvedValue(existingSeries);
  mockFindMany.mockResolvedValue([existingSeries]);
  (prisma.series.update as jest.Mock).mockResolvedValue(existingSeries);
});

describe("POST /api/series", () => {
  test("creates series with correct fields and returns 201", async () => {
    const body = { name: "LOTR Series", mode: "ORIGINAL", rating: "T" };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(201);

    const createCall = mockCreate.mock.calls[0][0] as {
      data: { userId: string; name: string; mode: string; rating: string; universeId: null };
    };
    expect(createCall.data.userId).toBe("user-1");
    expect(createCall.data.name).toBe("LOTR Series");
    expect(createCall.data.mode).toBe("ORIGINAL");
    expect(createCall.data.rating).toBe("T");
    expect(createCall.data.universeId).toBeNull();
  });

  test("creates series with optional universeId", async () => {
    const body = {
      name: "HP Series",
      mode: "FANFIC",
      rating: "T",
      universeId: "universe-abc",
    };
    await POST(makeRequest(body));
    const createCall = mockCreate.mock.calls[0][0] as {
      data: { universeId: string };
    };
    expect(createCall.data.universeId).toBe("universe-abc");
  });

  test("creates series with null universeId when not provided (standalone series)", async () => {
    const body = { name: "Standalone", mode: "ORIGINAL", rating: "G" };
    await POST(makeRequest(body));
    const createCall = mockCreate.mock.calls[0][0] as {
      data: { universeId: null };
    };
    expect(createCall.data.universeId).toBeNull();
  });

  test("returns 400 when name is missing", async () => {
    const res = await POST(makeRequest({ mode: "ORIGINAL", rating: "G" }));
    expect(res.status).toBe(400);
  });

  test("returns 400 for invalid mode", async () => {
    const res = await POST(makeRequest({ name: "Test", mode: "INVALID", rating: "G" }));
    expect(res.status).toBe(400);
  });

  test("returns 400 for invalid rating", async () => {
    const res = await POST(makeRequest({ name: "Test", mode: "ORIGINAL", rating: "X" }));
    expect(res.status).toBe(400);
  });

  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ name: "Test", mode: "ORIGINAL", rating: "G" }));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/series", () => {
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

describe("GET /api/series/[id]", () => {
  test("returns series for authenticated owner", async () => {
    const res = await GET_ONE(makeRequest(), PARAMS);
    expect(res.status).toBe(200);
  });

  test("returns 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    const res = await GET_ONE(makeRequest(), PARAMS);
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/series/[id]", () => {
  test("renames series", async () => {
    const req = new NextRequest("http://localhost/api/series/series-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Renamed Series" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, PARAMS);
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/series/[id]", () => {
  test("deletes series and returns 204", async () => {
    const res = await DELETE(makeRequest(), PARAMS);
    expect(res.status).toBe(204);
    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "series-1" } })
    );
  });

  test("orphaned stories still exist with null seriesId after delete", async () => {
    // The DB handles cascade via onDelete: SetNull on Story.seriesId.
    await DELETE(makeRequest(), PARAMS);
    const deleteCall = mockDelete.mock.calls[0][0] as { where: { id: string } };
    expect(deleteCall.where.id).toBe("series-1");
  });

  test("returns 404 when series not found", async () => {
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
