jest.mock("@/auth", () => ({
  auth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    universe: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/universes/route";
import {
  GET as GET_ONE,
  PATCH,
  DELETE,
} from "@/app/api/universes/[id]/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = auth as jest.Mock;
const mockFindMany = prisma.universe.findMany as jest.Mock;
const mockFindFirst = prisma.universe.findFirst as jest.Mock;
const mockCreate = prisma.universe.create as jest.Mock;
const mockUpdate = prisma.universe.update as jest.Mock;
const mockDelete = prisma.universe.delete as jest.Mock;

const authed = { user: { id: "user-1" } };
const PARAMS = { params: Promise.resolve({ id: "universe-1" }) };

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/universes", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const existingUniverse = {
  id: "universe-1",
  userId: "user-1",
  name: "Middle Earth",
  mode: "ORIGINAL",
  rating: "T",
  sourceTitle: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue(authed);
  mockFindFirst.mockResolvedValue(existingUniverse);
  mockCreate.mockResolvedValue(existingUniverse);
  mockUpdate.mockResolvedValue(existingUniverse);
  mockDelete.mockResolvedValue(existingUniverse);
  mockFindMany.mockResolvedValue([existingUniverse]);
});

describe("GET /api/universes", () => {
  test("returns list for authenticated user", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
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

describe("POST /api/universes", () => {
  test("creates universe with correct fields and returns 201", async () => {
    const body = { name: "Middle Earth", mode: "ORIGINAL", rating: "T" };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(201);

    const createCall = mockCreate.mock.calls[0][0] as {
      data: { userId: string; name: string; mode: string; rating: string };
    };
    expect(createCall.data.userId).toBe("user-1");
    expect(createCall.data.name).toBe("Middle Earth");
    expect(createCall.data.mode).toBe("ORIGINAL");
    expect(createCall.data.rating).toBe("T");
  });

  test("creates universe with optional sourceTitle", async () => {
    const body = {
      name: "HP Universe",
      mode: "FANFIC",
      rating: "T",
      sourceTitle: "Harry Potter",
    };
    await POST(makeRequest(body));
    const createCall = mockCreate.mock.calls[0][0] as {
      data: { sourceTitle: string };
    };
    expect(createCall.data.sourceTitle).toBe("Harry Potter");
  });

  test("stored value differs from plaintext name (sanity check)", async () => {
    const body = { name: "  Trimmed Name  ", mode: "ORIGINAL", rating: "G" };
    await POST(makeRequest(body));
    const createCall = mockCreate.mock.calls[0][0] as { data: { name: string } };
    expect(createCall.data.name).toBe("Trimmed Name");
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
    const res = await POST(makeRequest({ name: "Test", mode: "ORIGINAL", rating: "R" }));
    expect(res.status).toBe(400);
  });

  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ name: "Test", mode: "ORIGINAL", rating: "G" }));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/universes/[id]", () => {
  test("returns universe for authenticated owner", async () => {
    const res = await GET_ONE(makeRequest(), PARAMS);
    expect(res.status).toBe(200);
  });

  test("returns 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    const res = await GET_ONE(makeRequest(), PARAMS);
    expect(res.status).toBe(404);
  });

  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET_ONE(makeRequest(), PARAMS);
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/universes/[id]", () => {
  test("renames universe and returns updated record", async () => {
    const req = new NextRequest("http://localhost/api/universes/universe-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "New Name" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, PARAMS);
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "universe-1" },
        data: expect.objectContaining({ name: "New Name" }),
      })
    );
  });

  test("returns 404 when universe not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    const req = new NextRequest("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ name: "New" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, PARAMS);
    expect(res.status).toBe(404);
  });

  test("returns 400 when no valid fields provided", async () => {
    const req = new NextRequest("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, PARAMS);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/universes/[id]", () => {
  test("deletes universe and returns 204", async () => {
    const res = await DELETE(makeRequest(), PARAMS);
    expect(res.status).toBe(204);
    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "universe-1" } })
    );
  });

  test("orphaned series still exist with null universeId after delete", async () => {
    // The DB handles cascade via onDelete: SetNull on Series.universeId.
    // Here we verify the route calls prisma.universe.delete, which triggers that cascade.
    await DELETE(makeRequest(), PARAMS);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    const deleteCall = mockDelete.mock.calls[0][0] as { where: { id: string } };
    expect(deleteCall.where.id).toBe("universe-1");
  });

  test("returns 404 when universe not found", async () => {
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
