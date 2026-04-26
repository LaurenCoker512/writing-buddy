jest.mock("@/auth", () => ({ auth: jest.fn() }));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    document: { findFirst: jest.fn() },
    documentVersion: {
      count: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/documents/[id]/versions/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AI_CONFIG } from "@/config/ai";

const mockAuth = auth as jest.Mock;
const mockDocFindFirst = prisma.document.findFirst as jest.Mock;
const mockVersionCount = prisma.documentVersion.count as jest.Mock;
const mockVersionFindFirst = prisma.documentVersion.findFirst as jest.Mock;
const mockVersionDelete = prisma.documentVersion.delete as jest.Mock;
const mockVersionCreate = prisma.documentVersion.create as jest.Mock;

const authed = { user: { id: "user-1" } };
const PARAMS = { params: Promise.resolve({ id: "doc-1" }) };
const sampleJson = { type: "doc", content: [] };

const existingDoc = {
  id: "doc-1",
  story: { userId: "user-1" },
  series: null,
  universe: null,
};

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/documents/doc-1/versions", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue(authed);
  mockDocFindFirst.mockResolvedValue(existingDoc);
  mockVersionCreate.mockResolvedValue({
    id: "ver-new",
    documentId: "doc-1",
    tiptapJson: sampleJson,
    label: null,
    createdAt: new Date(),
  });
  mockVersionFindFirst.mockResolvedValue({ id: "ver-oldest" });
  mockVersionDelete.mockResolvedValue({ id: "ver-oldest" });
});

describe("Version cap enforcement", () => {
  test("does not delete when count is below cap", async () => {
    mockVersionCount.mockResolvedValue(AI_CONFIG.DOCUMENT_VERSION_CAP - 1);
    const res = await POST(makeRequest({ tiptapJson: sampleJson }), PARAMS);
    expect(res.status).toBe(201);
    expect(mockVersionDelete).not.toHaveBeenCalled();
    expect(mockVersionCreate).toHaveBeenCalledTimes(1);
  });

  test("deletes oldest version when count equals cap before inserting", async () => {
    mockVersionCount.mockResolvedValue(AI_CONFIG.DOCUMENT_VERSION_CAP);
    const res = await POST(makeRequest({ tiptapJson: sampleJson }), PARAMS);
    expect(res.status).toBe(201);
    expect(mockVersionFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "asc" } }),
    );
    expect(mockVersionDelete).toHaveBeenCalledTimes(1);
    expect(mockVersionCreate).toHaveBeenCalledTimes(1);
  });

  test("delete happens before create when at cap", async () => {
    const callOrder: string[] = [];
    mockVersionCount.mockResolvedValue(AI_CONFIG.DOCUMENT_VERSION_CAP);
    mockVersionDelete.mockImplementation(async () => {
      callOrder.push("delete");
      return { id: "ver-oldest" };
    });
    mockVersionCreate.mockImplementation(async () => {
      callOrder.push("create");
      return { id: "ver-new", documentId: "doc-1", tiptapJson: sampleJson, label: null, createdAt: new Date() };
    });

    await POST(makeRequest({ tiptapJson: sampleJson }), PARAMS);
    expect(callOrder).toEqual(["delete", "create"]);
  });
});
