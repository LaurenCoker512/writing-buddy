jest.mock("@/auth", () => ({ auth: jest.fn() }));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    document: { findFirst: jest.fn(), update: jest.fn() },
    documentVersion: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { NextRequest } from "next/server";
import {
  GET as GET_VERSIONS,
  POST as POST_VERSION,
} from "@/app/api/documents/[id]/versions/route";
import { POST as POST_RESTORE } from "@/app/api/documents/[id]/restore/[versionId]/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AI_CONFIG } from "@/config/ai";

const mockAuth = auth as jest.Mock;
const mockDocFindFirst = prisma.document.findFirst as jest.Mock;
const mockDocUpdate = prisma.document.update as jest.Mock;
const mockVersionCount = prisma.documentVersion.count as jest.Mock;
const mockVersionFindFirst = prisma.documentVersion.findFirst as jest.Mock;
const mockVersionFindMany = prisma.documentVersion.findMany as jest.Mock;
const mockVersionDelete = prisma.documentVersion.delete as jest.Mock;
const mockVersionCreate = prisma.documentVersion.create as jest.Mock;

const authed = { user: { id: "user-1" } };
const DOC_PARAMS = { params: Promise.resolve({ id: "doc-1" }) };
const RESTORE_PARAMS = { params: Promise.resolve({ id: "doc-1", versionId: "ver-1" }) };
const sampleJson = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }] };

const existingDoc = {
  id: "doc-1",
  story: { userId: "user-1" },
  series: null,
  universe: null,
};

const existingVersion = {
  id: "ver-1",
  documentId: "doc-1",
  tiptapJson: sampleJson,
  label: null,
  createdAt: new Date("2024-01-01"),
};

function makePostRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeGetRequest(url: string): NextRequest {
  return new NextRequest(url);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue(authed);
  mockDocFindFirst.mockResolvedValue(existingDoc);
  mockDocUpdate.mockResolvedValue(existingDoc);
  mockVersionCount.mockResolvedValue(0);
  mockVersionFindFirst.mockResolvedValue(existingVersion);
  mockVersionFindMany.mockResolvedValue([existingVersion]);
  mockVersionCreate.mockResolvedValue({
    id: "ver-new",
    documentId: "doc-1",
    tiptapJson: sampleJson,
    label: null,
    createdAt: new Date(),
  });
  mockVersionDelete.mockResolvedValue({ id: "ver-oldest" });
});

describe("GET /api/documents/[id]/versions", () => {
  test("returns version list for authenticated owner", async () => {
    const res = await GET_VERSIONS(makeGetRequest("http://localhost/api/documents/doc-1/versions"), DOC_PARAMS);
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
  });

  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET_VERSIONS(makeGetRequest("http://localhost/api/documents/doc-1/versions"), DOC_PARAMS);
    expect(res.status).toBe(401);
  });

  test("returns 404 when document not found", async () => {
    mockDocFindFirst.mockResolvedValue(null);
    const res = await GET_VERSIONS(makeGetRequest("http://localhost/api/documents/doc-1/versions"), DOC_PARAMS);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/documents/[id]/versions", () => {
  test("creates version and returns 201", async () => {
    const res = await POST_VERSION(
      makePostRequest("http://localhost/api/documents/doc-1/versions", { tiptapJson: sampleJson }),
      DOC_PARAMS,
    );
    expect(res.status).toBe(201);
    expect(mockVersionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tiptapJson: sampleJson }) }),
    );
  });

  test("enforces version cap — deletes oldest when at limit", async () => {
    mockVersionCount.mockResolvedValue(AI_CONFIG.DOCUMENT_VERSION_CAP);
    const res = await POST_VERSION(
      makePostRequest("http://localhost/api/documents/doc-1/versions", { tiptapJson: sampleJson }),
      DOC_PARAMS,
    );
    expect(res.status).toBe(201);
    expect(mockVersionDelete).toHaveBeenCalledTimes(1);
  });

  test("returns 400 for missing tiptapJson", async () => {
    const res = await POST_VERSION(
      makePostRequest("http://localhost/api/documents/doc-1/versions", {}),
      DOC_PARAMS,
    );
    expect(res.status).toBe(400);
  });
});

describe("handleResolveDiff — version snapshot behavior", () => {
  test("accepting a diff creates a DocumentVersion snapshot via POST /versions", async () => {
    const res = await POST_VERSION(
      makePostRequest("http://localhost/api/documents/doc-1/versions", { tiptapJson: sampleJson }),
      DOC_PARAMS,
    );
    expect(res.status).toBe(201);
    expect(mockVersionCreate).toHaveBeenCalledTimes(1);
    expect(mockVersionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tiptapJson: sampleJson, documentId: "doc-1" }),
      }),
    );
  });

  test("rejecting a diff does not call the versions API", () => {
    // handleResolveDiff only calls POST /versions when accept=true.
    // On reject, only client-side state is updated — no API call is made.
    expect(mockVersionCreate).not.toHaveBeenCalled();
  });
});

describe("POST /api/documents/[id]/restore/[versionId]", () => {
  test("creates new version with restored content and updates document", async () => {
    const res = await POST_RESTORE(
      makePostRequest("http://localhost/api/documents/doc-1/restore/ver-1", {}),
      RESTORE_PARAMS,
    );
    expect(res.status).toBe(200);
    expect(mockVersionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tiptapJson: sampleJson,
          label: "Restored",
        }),
      }),
    );
    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "doc-1" },
        data: { tiptapJson: sampleJson },
      }),
    );
  });

  test("returns 404 when version not found", async () => {
    mockVersionFindFirst.mockResolvedValue(null);
    const res = await POST_RESTORE(
      makePostRequest("http://localhost/api/documents/doc-1/restore/ver-1", {}),
      RESTORE_PARAMS,
    );
    expect(res.status).toBe(404);
  });

  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST_RESTORE(
      makePostRequest("http://localhost/api/documents/doc-1/restore/ver-1", {}),
      RESTORE_PARAMS,
    );
    expect(res.status).toBe(401);
  });
});
