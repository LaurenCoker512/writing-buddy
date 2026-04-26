import { buildTemplate } from "@/lib/document-templates";

describe("buildTemplate", () => {
  test("CHARACTER returns TipTap JSON with all 11 suggested headings", () => {
    const doc = buildTemplate("CHARACTER");
    expect(doc.type).toBe("doc");
    expect(doc.content).toHaveLength(11);
    expect(doc.content[0]).toMatchObject({
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Name / Aliases" }],
    });
    const texts = doc.content.map((node) => node.content[0].text);
    expect(texts).toContain("Backstory");
    expect(texts).toContain("Thematic Function");
  });

  test("RELATIONSHIP returns TipTap JSON with all 5 suggested headings", () => {
    const doc = buildTemplate("RELATIONSHIP");
    expect(doc.content).toHaveLength(5);
    const texts = doc.content.map((node) => node.content[0].text);
    expect(texts[0]).toBe("Characters Involved");
    expect(texts).toContain("History");
    expect(texts).toContain("Trajectory / How It Evolves");
  });

  test("PLOT returns TipTap JSON with all 7 suggested headings", () => {
    const doc = buildTemplate("PLOT");
    expect(doc.content).toHaveLength(7);
    const texts = doc.content.map((node) => node.content[0].text);
    expect(texts[0]).toBe("Premise");
    expect(texts).toContain("Climax");
    expect(texts).toContain("Key Themes");
  });

  test("SCENE returns TipTap JSON with all 8 suggested headings", () => {
    const doc = buildTemplate("SCENE");
    expect(doc.content).toHaveLength(8);
    const texts = doc.content.map((node) => node.content[0].text);
    expect(texts[0]).toBe("POV Character");
    expect(texts).toContain("Scene Goal");
    expect(texts).toContain("Notes / Brainstorm");
  });

  test("WORLDBUILDING returns empty doc (no suggested headings)", () => {
    const doc = buildTemplate("WORLDBUILDING");
    expect(doc.type).toBe("doc");
    expect(doc.content).toHaveLength(0);
  });

  test("OTHER returns empty doc", () => {
    const doc = buildTemplate("OTHER");
    expect(doc.content).toHaveLength(0);
  });

  test("all heading nodes have level 2", () => {
    const charDoc = buildTemplate("CHARACTER");
    charDoc.content.forEach((node) => {
      expect(node.attrs.level).toBe(2);
    });
  });
});
