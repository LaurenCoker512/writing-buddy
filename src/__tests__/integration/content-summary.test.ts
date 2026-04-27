jest.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

import { ensureContentSummariesFresh } from "@/lib/content-summary";
import { OpenRouterProvider } from "@/lib/ai-provider";
import { prisma } from "@/lib/prisma";

const mockFindMany = prisma.document.findMany as jest.Mock;
const mockUpdate = prisma.document.update as jest.Mock;

const provider = new OpenRouterProvider("test-api-key");
const NOW = new Date("2024-01-10T12:00:00Z");
const OLDER = new Date("2024-01-09T12:00:00Z");

function makeAiResponse(content: string): Response {
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content } }],
    }),
  } as unknown as Response;
}

describe("ensureContentSummariesFresh", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdate.mockResolvedValue({});
  });

  test("returns empty array when given no document ids", async () => {
    const result = await ensureContentSummariesFresh([], provider);
    expect(result).toEqual([]);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  test("regenerates summary when contentSummary is null", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "doc-1",
        type: "CHARACTER",
        name: "Aria",
        tiptapJson: { type: "doc", content: [] },
        contentSummary: null,
        contentSummaryGeneratedAt: null,
        updatedAt: NOW,
      },
    ]);
    mockFetch.mockResolvedValue(makeAiResponse("Aria is a rogue."));

    const result = await ensureContentSummariesFresh(["doc-1"], provider);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "doc-1" },
        data: expect.objectContaining({ contentSummary: "Aria is a rogue." }),
      }),
    );
    expect(result[0]!.contentSummary).toBe("Aria is a rogue.");
  });

  test("regenerates summary when contentSummaryGeneratedAt is older than updatedAt", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "doc-2",
        type: "WORLDBUILDING",
        name: "Magic System",
        tiptapJson: { type: "doc", content: [] },
        contentSummary: "Old summary.",
        contentSummaryGeneratedAt: OLDER,
        updatedAt: NOW,
      },
    ]);
    mockFetch.mockResolvedValue(makeAiResponse("Updated magic summary."));

    const result = await ensureContentSummariesFresh(["doc-2"], provider);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result[0]!.contentSummary).toBe("Updated magic summary.");
  });

  test("skips regeneration when summary is fresh", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "doc-3",
        type: "PLOT",
        name: "Act 1",
        tiptapJson: { type: "doc", content: [] },
        contentSummary: "Existing summary.",
        contentSummaryGeneratedAt: NOW,
        updatedAt: OLDER,
      },
    ]);

    const result = await ensureContentSummariesFresh(["doc-3"], provider);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(result[0]!.contentSummary).toBe("Existing summary.");
  });

  test("leaves summary unchanged when AI call fails", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "doc-4",
        type: "CHARACTER",
        name: "Ghost",
        tiptapJson: { type: "doc", content: [] },
        contentSummary: null,
        contentSummaryGeneratedAt: null,
        updatedAt: NOW,
      },
    ]);
    mockFetch.mockResolvedValue({ ok: false } as Response);

    const result = await ensureContentSummariesFresh(["doc-4"], provider);

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(result[0]!.contentSummary).toBeNull();
  });
});
