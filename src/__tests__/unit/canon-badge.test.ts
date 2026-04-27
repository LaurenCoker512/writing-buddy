import { parseInlineBadges } from "@/lib/canon-badge";

describe("parseInlineBadges", () => {
  test("returns single text segment for plain text", () => {
    const result = parseInlineBadges("Just some normal text.");
    expect(result).toEqual([{ type: "text", content: "Just some normal text." }]);
  });

  test("identifies **[Canon]** marker", () => {
    const result = parseInlineBadges("Harry Potter **[Canon]** is a wizard.");
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ type: "text", content: "Harry Potter " });
    expect(result[1]).toEqual({ type: "canon" });
    expect(result[2]).toEqual({ type: "text", content: " is a wizard." });
  });

  test("identifies bare [Canon] marker", () => {
    const result = parseInlineBadges("Harry [Canon] is a wizard.");
    expect(result).toHaveLength(3);
    expect(result[1]).toEqual({ type: "canon" });
  });

  test("identifies **[AU]** marker", () => {
    const result = parseInlineBadges("This AU version **[AU]** differs from canon.");
    expect(result).toHaveLength(3);
    expect(result[1]).toEqual({ type: "au" });
  });

  test("identifies bare [AU] marker", () => {
    const result = parseInlineBadges("An [AU] variant.");
    expect(result).toHaveLength(3);
    expect(result[1]).toEqual({ type: "au" });
  });

  test("handles multiple badges in one string", () => {
    const result = parseInlineBadges("**[Canon]** fact and **[AU]** twist.");
    const types = result.map((s) => s.type);
    expect(types).toContain("canon");
    expect(types).toContain("au");
  });

  test("handles badge at start of string", () => {
    const result = parseInlineBadges("**[Canon]** This is canon.");
    expect(result[0]).toEqual({ type: "canon" });
    expect(result[1]).toEqual({ type: "text", content: " This is canon." });
  });

  test("handles badge at end of string", () => {
    const result = parseInlineBadges("This is canon **[Canon]**");
    expect(result[result.length - 1]).toEqual({ type: "canon" });
  });

  test("is case-insensitive", () => {
    const result = parseInlineBadges("**[CANON]** text.");
    expect(result[0]).toEqual({ type: "canon" });
  });

  test("returns text segment for empty string", () => {
    const result = parseInlineBadges("");
    expect(result).toEqual([{ type: "text", content: "" }]);
  });
});
