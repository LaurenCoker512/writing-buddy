import { buildPlotTemplateWithPremise, type TipTapPlotDoc, type TipTapHeadingNode } from "@/lib/document-templates";

describe("buildPlotTemplateWithPremise", () => {
  const logline = "A lone detective uncovers a conspiracy that reaches the highest levels.";

  test("returns a doc with PLOT headings", () => {
    const doc = buildPlotTemplateWithPremise(logline) as unknown as TipTapPlotDoc;
    expect(doc.type).toBe("doc");
    const headings = doc.content.filter((n) => n.type === "heading") as TipTapHeadingNode[];
    expect(headings.length).toBeGreaterThan(0);
    const headingTexts = headings.map((n) => n.content[0].text);
    expect(headingTexts).toContain("Premise");
    expect(headingTexts).toContain("Inciting Incident");
    expect(headingTexts).toContain("Climax");
  });

  test("inserts logline as paragraph immediately after Premise heading", () => {
    const doc = buildPlotTemplateWithPremise(logline) as unknown as TipTapPlotDoc;
    const premiseIdx = doc.content.findIndex(
      (n) => n.type === "heading" && (n as TipTapHeadingNode).content[0].text === "Premise",
    );
    expect(premiseIdx).toBeGreaterThanOrEqual(0);

    const nextNode = doc.content[premiseIdx + 1];
    expect(nextNode).toBeDefined();
    expect(nextNode!.type).toBe("paragraph");
    const para = nextNode as { type: "paragraph"; content: [{ type: "text"; text: string }] };
    expect(para.content[0].text).toBe(logline);
  });

  test("does not insert paragraphs after other headings", () => {
    const doc = buildPlotTemplateWithPremise(logline) as unknown as TipTapPlotDoc;
    const paragraphCount = doc.content.filter((n) => n.type === "paragraph").length;
    expect(paragraphCount).toBe(1);
  });
});
