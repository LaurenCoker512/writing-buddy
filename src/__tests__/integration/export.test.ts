jest.mock("@/auth", () => ({ auth: jest.fn() }));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    document: { findFirst: jest.fn() },
    story: { findFirst: jest.fn() },
  },
}));

jest.mock("@react-pdf/renderer", () => ({
  Document: jest.fn(),
  Page: jest.fn(),
  Text: jest.fn(),
  View: jest.fn(),
  StyleSheet: { create: (styles: unknown) => styles },
  renderToBuffer: jest.fn().mockResolvedValue(Buffer.from("%PDF-mock")),
}));

import { NextRequest } from "next/server";
import { GET as GET_MARKDOWN } from "@/app/api/export/document/[id]/markdown/route";
import { GET as GET_PDF } from "@/app/api/export/document/[id]/pdf/route";
import { GET as GET_ZIP } from "@/app/api/export/project/[id]/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = auth as jest.Mock;
const mockDocFindFirst = prisma.document.findFirst as jest.Mock;
const mockStoryFindFirst = prisma.story.findFirst as jest.Mock;

const PARAMS = { params: Promise.resolve({ id: "doc-1" }) };
const PROJECT_PARAMS = { params: Promise.resolve({ id: "story-1" }) };
const authed = { user: { id: "user-1" } };

const tiptapJson = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "My Heading" }] },
    { type: "paragraph", content: [{ type: "text", text: "Some content here." }] },
  ],
};

const existingDocument = {
  id: "doc-1",
  name: "Aragorn",
  type: "CHARACTER",
  tiptapJson,
  storyId: "story-1",
  seriesId: null,
  universeId: null,
  story: { userId: "user-1" },
  series: null,
  universe: null,
};

const existingStory = {
  id: "story-1",
  name: "Fellowship",
  mode: "ORIGINAL",
  rating: "T",
  userId: "user-1",
  documents: [existingDocument],
};

function makeRequest(method = "GET"): NextRequest {
  return new NextRequest("http://localhost/api/export/document/doc-1", { method });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue(authed);
  mockDocFindFirst.mockResolvedValue(existingDocument);
  mockStoryFindFirst.mockResolvedValue(existingStory);
});

describe("GET /api/export/document/[id]/markdown", () => {
  test("returns text/markdown with attachment disposition", async () => {
    const res = await GET_MARKDOWN(makeRequest(), PARAMS);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/markdown");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Content-Disposition")).toContain(".md");
  });

  test("response body contains heading from tiptapJson", async () => {
    const res = await GET_MARKDOWN(makeRequest(), PARAMS);
    const text = await res.text();
    expect(text).toContain("# My Heading");
    expect(text).toContain("Some content here.");
  });

  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET_MARKDOWN(makeRequest(), PARAMS);
    expect(res.status).toBe(401);
  });

  test("returns 404 when document not found", async () => {
    mockDocFindFirst.mockResolvedValue(null);
    const res = await GET_MARKDOWN(makeRequest(), PARAMS);
    expect(res.status).toBe(404);
  });

  test("returns 404 when document belongs to another user", async () => {
    mockDocFindFirst.mockResolvedValue({
      ...existingDocument,
      story: { userId: "other-user" },
    });
    const res = await GET_MARKDOWN(makeRequest(), PARAMS);
    expect(res.status).toBe(404);
  });
});

describe("GET /api/export/document/[id]/pdf", () => {
  test("returns application/pdf response", async () => {
    const res = await GET_PDF(makeRequest(), PARAMS);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Content-Disposition")).toContain(".pdf");
  });

  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET_PDF(makeRequest(), PARAMS);
    expect(res.status).toBe(401);
  });

  test("returns 404 when document not found", async () => {
    mockDocFindFirst.mockResolvedValue(null);
    const res = await GET_PDF(makeRequest(), PARAMS);
    expect(res.status).toBe(404);
  });
});

describe("GET /api/export/project/[id]", () => {
  test("returns application/zip with correct content-disposition", async () => {
    const res = await GET_ZIP(makeRequest(), PROJECT_PARAMS);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Content-Disposition")).toContain(".zip");
  });

  test("zip contains README.md and at least one document file", async () => {
    const JSZip = (await import("jszip")).default;
    const res = await GET_ZIP(makeRequest(), PROJECT_PARAMS);
    const buffer = Buffer.from(await res.arrayBuffer());
    const zip = await JSZip.loadAsync(buffer);
    const files = Object.keys(zip.files);

    expect(files.some((f) => f.endsWith("README.md"))).toBe(true);
    expect(files.some((f) => f.endsWith(".md") && !f.endsWith("README.md"))).toBe(true);
  });

  test("document with special characters in name uses a safe filename (no path traversal)", async () => {
    mockStoryFindFirst.mockResolvedValue({
      ...existingStory,
      documents: [{ ...existingDocument, name: "My/Doc: Test?" }],
    });

    const JSZip = (await import("jszip")).default;
    const res = await GET_ZIP(makeRequest(), PROJECT_PARAMS);
    const buffer = Buffer.from(await res.arrayBuffer());
    const zip = await JSZip.loadAsync(buffer);
    const files = Object.keys(zip.files);

    // Document files: ends with .md but not README.md
    const docFiles = files.filter(
      (f) => f.endsWith(".md") && !f.endsWith("README.md"),
    );
    expect(docFiles.length).toBeGreaterThan(0);

    // Each path has exactly 3 segments: {story}/{section}/{filename}.md
    // A "/" in the original name would add an extra segment
    expect(docFiles.every((f) => f.split("/").length === 3)).toBe(true);

    // "My/Doc: Test?" → strip [/:?] → "MyDoc Test" → "MyDoc-Test"
    const filenames = docFiles.map((f) => f.split("/")[2]);
    expect(filenames.some((name) => name === "MyDoc-Test.md")).toBe(true);
  });

  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET_ZIP(makeRequest(), PROJECT_PARAMS);
    expect(res.status).toBe(401);
  });

  test("returns 404 when story not found", async () => {
    mockStoryFindFirst.mockResolvedValue(null);
    const res = await GET_ZIP(makeRequest(), PROJECT_PARAMS);
    expect(res.status).toBe(404);
  });
});
