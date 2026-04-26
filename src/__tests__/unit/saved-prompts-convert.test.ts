import { buildPlotTemplateWithPremise } from "@/lib/document-templates";

describe("buildPlotTemplateWithPremise", () => {
  const logline = "A lone detective uncovers a conspiracy that reaches the highest levels.";

  test("returns a doc with PLOT headings", () => {
    const doc = buildPlotTemplateWithPremise(logline);
    expect(doc.type).toBe("doc");
    const headings = doc.content.filter((n) => n.type === "heading");
    expect(headings.length).toBeGreaterThan(0);
    const headingTexts = headings.map(
      (n) => (n as { type: "heading"; content: [{ type: "text"; text: string }] }).content[0].text,
    );
    expect(headingTexts).toContain("Premise");
    expect(headingTexts).toContain("Inciting Incident");
    expect(headingTexts).toContain("Climax");
  });

  test("inserts logline as paragraph immediately after Premise heading", () => {
    const doc = buildPlotTemplateWithPremise(logline);
    const premiseIdx = doc.content.findIndex(
      (n) =>
        n.type === "heading" &&
        (n as { type: "heading"; content: [{ type: "text"; text: string }] }).content[0].text ===
          "Premise",
    );
    expect(premiseIdx).toBeGreaterThanOrEqual(0);

    const nextNode = doc.content[premiseIdx + 1];
    expect(nextNode).toBeDefined();
    expect(nextNode!.type).toBe("paragraph");
    const para = nextNode as { type: "paragraph"; content: [{ type: "text"; text: string }] };
    expect(para.content[0].text).toBe(logline);
  });

  test("does not insert paragraphs after other headings", () => {
    const doc = buildPlotTemplateWithPremise(logline);
    const paragraphCount = doc.content.filter((n) => n.type === "paragraph").length;
    expect(paragraphCount).toBe(1);
  });
});
