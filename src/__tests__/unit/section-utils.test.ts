import {
  replaceSectionInTipTap,
  appendSectionToTipTap,
  getSectionMarkdown,
} from "@/lib/section-utils";
import type { TipTapDoc } from "@/lib/section-utils";
import type { TipTapNode } from "@/lib/tiptap-to-markdown";

const sampleDoc: TipTapDoc = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Title" }] },
    { type: "paragraph", content: [{ type: "text", text: "Intro text." }] },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Background" }] },
    { type: "paragraph", content: [{ type: "text", text: "Background content." }] },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Personality" }] },
    { type: "paragraph", content: [{ type: "text", text: "Personality content." }] },
  ],
};

const updatedBackgroundNodes: TipTapNode[] = [
  { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Background" }] },
  { type: "paragraph", content: [{ type: "text", text: "Updated background." }] },
];

describe("replaceSectionInTipTap", () => {
  test("replaces matching heading section with new nodes", () => {
    const result = replaceSectionInTipTap(sampleDoc, "Background", updatedBackgroundNodes);

    const updatedPara = result.content.find(
      (n) => n.type === "paragraph" && n.content?.[0]?.text === "Updated background.",
    );
    expect(updatedPara).toBeDefined();

    const oldPara = result.content.find(
      (n) => n.type === "paragraph" && n.content?.[0]?.text === "Background content.",
    );
    expect(oldPara).toBeUndefined();
  });

  test("section ends at next heading of same level, preserving siblings", () => {
    const result = replaceSectionInTipTap(sampleDoc, "Background", updatedBackgroundNodes);

    const personalityHeading = result.content.find(
      (n) => n.type === "heading" && n.content?.[0]?.text === "Personality",
    );
    expect(personalityHeading).toBeDefined();
  });

  test("returns unchanged document when heading is not found", () => {
    const result = replaceSectionInTipTap(sampleDoc, "Nonexistent Section", []);
    expect(result).toEqual(sampleDoc);
  });

  test("section under a higher-level heading ends at same or higher level", () => {
    const doc: TipTapDoc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Chapter" }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Sub" }] },
        { type: "paragraph", content: [{ type: "text", text: "Sub content." }] },
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Chapter 2" }] },
      ],
    };

    const result = replaceSectionInTipTap(doc, "Sub", [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Sub" }] },
      { type: "paragraph", content: [{ type: "text", text: "New sub content." }] },
    ]);

    const chapter2 = result.content.find(
      (n) => n.type === "heading" && n.content?.[0]?.text === "Chapter 2",
    );
    expect(chapter2).toBeDefined();

    const oldPara = result.content.find(
      (n) => n.type === "paragraph" && n.content?.[0]?.text === "Sub content.",
    );
    expect(oldPara).toBeUndefined();
  });
});

describe("appendSectionToTipTap", () => {
  test("appends new nodes to document end", () => {
    const newNode: TipTapNode = {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "New Section" }],
    };

    const result = appendSectionToTipTap(sampleDoc, [newNode]);
    expect(result.content).toHaveLength(sampleDoc.content.length + 1);
    expect(result.content.at(-1)).toEqual(newNode);
  });

  test("appends to an empty document", () => {
    const emptyDoc: TipTapDoc = { type: "doc", content: [] };
    const result = appendSectionToTipTap(emptyDoc, [
      { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
    ]);
    expect(result.content).toHaveLength(1);
  });

  test("does not mutate the original document", () => {
    const original = { ...sampleDoc, content: [...sampleDoc.content] };
    appendSectionToTipTap(sampleDoc, [{ type: "paragraph", content: [] }]);
    expect(sampleDoc.content).toHaveLength(original.content.length);
  });
});

describe("getSectionMarkdown", () => {
  test("returns markdown for a matching section including heading", () => {
    const md = getSectionMarkdown(sampleDoc, "Background");
    expect(md).toContain("## Background");
    expect(md).toContain("Background content.");
  });

  test("does not include content from adjacent sections", () => {
    const md = getSectionMarkdown(sampleDoc, "Background");
    expect(md).not.toContain("Personality");
  });

  test("returns empty string when heading is not found", () => {
    const md = getSectionMarkdown(sampleDoc, "Missing Section");
    expect(md).toBe("");
  });
});
