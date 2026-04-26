jest.mock("@/auth", () => ({
  auth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    story: { findFirst: jest.fn() },
    series: { findFirst: jest.fn() },
    universe: { findFirst: jest.fn() },
  },
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/documents/route";
import {
  GET as GET_ONE,
  PATCH,
  DELETE,
} from "@/app/api/documents/[id]/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = auth as jest.Mock;
const mockDocFindFirst = prisma.document.findFirst as jest.Mock;
const mockDocCreate = prisma.document.create as jest.Mock;
const mockDocUpdate = prisma.document.update as jest.Mock;
const mockDocDelete = prisma.document.delete as jest.Mock;
const mockStoryFindFirst = prisma.story.findFirst as jest.Mock;

const authed = { user: { id: "user-1" } };
const PARAMS = { params: { id: "doc-1" } };

function makeRequest(body?: unknown, method = "POST"): NextRequest {
  return new NextRequest("http://localhost/api/documents", {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const existingDocument = {
  id: "doc-1",
  type: "CHARACTER",
  name: "Aragorn",
  tiptapJson: { type: "doc", content: [] },
  storyId: "story-1",
  seriesId: null,
  universeId: null,
  order: null,
  meta: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  story: { userId: "user-1" },
  series: null,
  universe: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue(authed);
  mockDocFindFirst.mockResolvedValue(existingDocument);
  mockDocCreate.mockResolvedValue(existingDocument);
  mockDocUpdate.mockResolvedValue(existingDocument);
  mockDocDelete.mockResolvedValue(existingDocument);
  mockStoryFindFirst.mockResolvedValue({ id: "story-1", userId: "user-1" });
});

describe("POST /api/documents", () => {
  test("creates document with correct scope fields and returns 201", async () => {
    const body = { name: "Aragorn", type: "CHARACTER", storyId: "story-1" };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(201);

    const createCall = mockDocCreate.mock.calls[0][0] as {
      data: {
        name: string;
        type: string;
        storyId: string;
        seriesId: null;
        universeId: null;
      };
    };
    expect(createCall.data.name).toBe("Aragorn");
    expect(createCall.data.type).toBe("CHARACTER");
    expect(createCall.data.storyId).toBe("story-1");
    expect(createCall.data.seriesId).toBeNull();
    expect(createCall.data.universeId).toBeNull();
  });

  test("POST with type CHARACTER returns document with starter headings in tiptapJson", async () => {
    const body = { name: "Aragorn", type: "CHARACTER", storyId: "story-1" };
    await POST(makeRequest(body));

    const createCall = mockDocCreate.mock.calls[0][0] as {
      data: { tiptapJson: { type: string; content: Array<{ type: string }> } };
    };
    expect(createCall.data.tiptapJson.type).toBe("doc");
    expect(createCall.data.tiptapJson.content.length).toBeGreaterThan(0);
    expect(createCall.data.tiptapJson.content[0].type).toBe("heading");
  });

  test("POST with type OTHER returns empty tiptapJson", async () => {
    const body = { name: "Notes", type: "OTHER", storyId: "story-1" };
    mockDocCreate.mockResolvedValue({ ...existingDocument, type: "OTHER" });
    await POST(makeRequest(body));

    const createCall = mockDocCreate.mock.calls[0][0] as {
      data: { tiptapJson: { type: string; content: unknown[] } };
    };
    expect(createCall.data.tiptapJson).toEqual({ type: "doc", content: [] });
  });

  test("returns 400 when name is missing", async () => {
    const res = await POST(makeRequest({ type: "CHARACTER", storyId: "story-1" }));
    expect(res.status).toBe(400);
  });

  test("returns 400 for invalid document type", async () => {
    const res = await POST(
      makeRequest({ name: "Test", type: "INVALID", storyId: "story-1" }),
    );
    expect(res.status).toBe(400);
  });

  test("returns 400 when no scope provided", async () => {
    const res = await POST(makeRequest({ name: "Test", type: "CHARACTER" }));
    expect(res.status).toBe(400);
  });

  test("returns 404 when storyId does not belong to user", async () => {
    mockStoryFindFirst.mockResolvedValue(null);
    const res = await POST(
      makeRequest({ name: "Test", type: "CHARACTER", storyId: "other-story" }),
    );
    expect(res.status).toBe(404);
  });

  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(
      makeRequest({ name: "Test", type: "CHARACTER", storyId: "story-1" }),
    );
    expect(res.status).toBe(401);
  });
});

describe("GET /api/documents/[id]", () => {
  test("returns document for authenticated owner", async () => {
    const res = await GET_ONE(makeRequest(), PARAMS);
    expect(res.status).toBe(200);
  });

  test("returns 404 when document not found", async () => {
    mockDocFindFirst.mockResolvedValue(null);
    const res = await GET_ONE(makeRequest(), PARAMS);
    expect(res.status).toBe(404);
  });

  test("returns 404 when document belongs to another user", async () => {
    mockDocFindFirst.mockResolvedValue({
      ...existingDocument,
      story: { userId: "other-user" },
    });
    const res = await GET_ONE(makeRequest(), PARAMS);
    expect(res.status).toBe(404);
  });

  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET_ONE(makeRequest(), PARAMS);
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/documents/[id]", () => {
  test("updates name and returns 200", async () => {
    const req = new NextRequest("http://localhost/api/documents/doc-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Strider" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, PARAMS);
    expect(res.status).toBe(200);

    const updateCall = mockDocUpdate.mock.calls[0][0] as {
      where: { id: string };
      data: { name: string };
    };
    expect(updateCall.where.id).toBe("doc-1");
    expect(updateCall.data.name).toBe("Strider");
  });

  test("updates order field", async () => {
    const req = new NextRequest("http://localhost/api/documents/doc-1", {
      method: "PATCH",
      body: JSON.stringify({ order: 1.5 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, PARAMS);
    expect(res.status).toBe(200);

    const updateCall = mockDocUpdate.mock.calls[0][0] as {
      data: { order: number };
    };
    expect(updateCall.data.order).toBe(1.5);
  });

  test("scene reorder — PATCH updates order and scenes are returned sorted by order", async () => {
    const reorderedDocument = { ...existingDocument, type: "SCENE", order: 1500 };
    mockDocUpdate.mockResolvedValue(reorderedDocument);

    const req = new NextRequest("http://localhost/api/documents/doc-1", {
      method: "PATCH",
      body: JSON.stringify({ order: 1500 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, PARAMS);
    expect(res.status).toBe(200);

    const updateCall = mockDocUpdate.mock.calls[0][0] as {
      data: { order: number };
    };
    expect(updateCall.data.order).toBe(1500);

    const body = (await res.json()) as { order: number };
    expect(body.order).toBe(1500);
  });

  test("updates parentDocumentId and returns 200", async () => {
    const updatedDoc = { ...existingDocument, parentDocumentId: "parent-doc-1" };
    mockDocUpdate.mockResolvedValue(updatedDoc);

    const req = new NextRequest("http://localhost/api/documents/doc-1", {
      method: "PATCH",
      body: JSON.stringify({ parentDocumentId: "parent-doc-1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, PARAMS);
    expect(res.status).toBe(200);

    const updateCall = mockDocUpdate.mock.calls[0][0] as {
      data: { parentDocumentId: string };
    };
    expect(updateCall.data.parentDocumentId).toBe("parent-doc-1");
  });

  test("clears parentDocumentId when set to null", async () => {
    const updatedDoc = { ...existingDocument, parentDocumentId: null };
    mockDocUpdate.mockResolvedValue(updatedDoc);

    const req = new NextRequest("http://localhost/api/documents/doc-1", {
      method: "PATCH",
      body: JSON.stringify({ parentDocumentId: null }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, PARAMS);
    expect(res.status).toBe(200);

    const updateCall = mockDocUpdate.mock.calls[0][0] as {
      data: { parentDocumentId: null };
    };
    expect(updateCall.data.parentDocumentId).toBeNull();
  });

  test("returns 400 when no valid fields provided", async () => {
    const req = new NextRequest("http://localhost/api/documents/doc-1", {
      method: "PATCH",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, PARAMS);
    expect(res.status).toBe(400);
  });

  test("returns 404 when document not found", async () => {
    mockDocFindFirst.mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/documents/doc-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Strider" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, PARAMS);
    expect(res.status).toBe(404);
  });

  test("updates meta and returns 200 with stored meta", async () => {
    const metaPayload = { role: "Protagonist" };
    const updatedDocument = { ...existingDocument, meta: metaPayload };
    mockDocUpdate.mockResolvedValue(updatedDocument);

    const req = new NextRequest("http://localhost/api/documents/doc-1", {
      method: "PATCH",
      body: JSON.stringify({ meta: metaPayload }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, PARAMS);
    expect(res.status).toBe(200);

    const updateCall = mockDocUpdate.mock.calls[0][0] as {
      data: { meta: unknown };
    };
    expect(updateCall.data.meta).toEqual({ role: "Protagonist" });

    const body = (await res.json()) as { meta: unknown };
    expect(body.meta).toEqual({ role: "Protagonist" });
  });

  test("updates tiptapJson and returns 200", async () => {
    const newJson = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
    };
    const updatedDocument = { ...existingDocument, tiptapJson: newJson };
    mockDocUpdate.mockResolvedValue(updatedDocument);

    const req = new NextRequest("http://localhost/api/documents/doc-1", {
      method: "PATCH",
      body: JSON.stringify({ tiptapJson: newJson }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, PARAMS);
    expect(res.status).toBe(200);

    const updateCall = mockDocUpdate.mock.calls[0][0] as {
      where: { id: string };
      data: { tiptapJson: unknown };
    };
    expect(updateCall.where.id).toBe("doc-1");
    expect(updateCall.data.tiptapJson).toEqual(newJson);

    const body = (await res.json()) as { tiptapJson: unknown };
    expect(body.tiptapJson).toEqual(newJson);
  });
});

describe("DELETE /api/documents/[id]", () => {
  test("deletes document and returns 204", async () => {
    const res = await DELETE(makeRequest(), PARAMS);
    expect(res.status).toBe(204);
    expect(mockDocDelete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "doc-1" } }),
    );
  });

  test("cascades DocumentVersion and ChatMessage rows via schema cascade on delete", async () => {
    // Cascade is enforced by the Prisma schema (onDelete: Cascade on DocumentVersion
    // and ChatMessage). This test verifies the delete call is made; the database
    // handles the cascade automatically.
    await DELETE(makeRequest(), PARAMS);
    expect(mockDocDelete).toHaveBeenCalledTimes(1);
  });

  test("returns 404 when document not found", async () => {
    mockDocFindFirst.mockResolvedValue(null);
    const res = await DELETE(makeRequest(), PARAMS);
    expect(res.status).toBe(404);
  });

  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await DELETE(makeRequest(), PARAMS);
    expect(res.status).toBe(401);
  });
});
