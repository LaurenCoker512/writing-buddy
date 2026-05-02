import {
  isDocumentType,
  isValidDocumentScope,
  DOCUMENT_TYPE_ORDER,
  DOCUMENT_SECTION_LABELS,
  DOCUMENT_TYPE_LABELS,
} from "@/lib/documents";

describe("isDocumentType", () => {
  test("accepts all valid document types", () => {
    expect(isDocumentType("BRAINSTORM")).toBe(true);
    expect(isDocumentType("CHARACTER")).toBe(true);
    expect(isDocumentType("RELATIONSHIP")).toBe(true);
    expect(isDocumentType("WORLDBUILDING")).toBe(true);
    expect(isDocumentType("PLOT")).toBe(true);
    expect(isDocumentType("SCENE")).toBe(true);
    expect(isDocumentType("OTHER")).toBe(true);
  });

  test("rejects invalid values", () => {
    expect(isDocumentType("character")).toBe(false);
    expect(isDocumentType("notes")).toBe(false);
    expect(isDocumentType("")).toBe(false);
    expect(isDocumentType(null)).toBe(false);
    expect(isDocumentType(undefined)).toBe(false);
    expect(isDocumentType(42)).toBe(false);
  });
});

describe("isValidDocumentScope", () => {
  test("document with storyId set and null seriesId/universeId is valid (standalone story)", () => {
    expect(isValidDocumentScope("story-1", null, null)).toBe(true);
  });

  test("document with seriesId set and null storyId is valid (series-level)", () => {
    expect(isValidDocumentScope(null, "series-1", null)).toBe(true);
  });

  test("document with universeId set and null seriesId/storyId is valid (universe-level)", () => {
    expect(isValidDocumentScope(null, null, "universe-1")).toBe(true);
  });

  test("document with storyId set plus seriesId and universeId is valid (story in full hierarchy)", () => {
    expect(isValidDocumentScope("story-1", "series-1", "universe-1")).toBe(true);
  });

  test("document with all null scopes is invalid", () => {
    expect(isValidDocumentScope(null, null, null)).toBe(false);
  });
});

describe("document type metadata", () => {
  test("DOCUMENT_TYPE_ORDER contains all seven types", () => {
    expect(DOCUMENT_TYPE_ORDER).toHaveLength(7);
    expect(DOCUMENT_TYPE_ORDER).toContain("BRAINSTORM");
    expect(DOCUMENT_TYPE_ORDER).toContain("CHARACTER");
    expect(DOCUMENT_TYPE_ORDER).toContain("RELATIONSHIP");
    expect(DOCUMENT_TYPE_ORDER).toContain("WORLDBUILDING");
    expect(DOCUMENT_TYPE_ORDER).toContain("PLOT");
    expect(DOCUMENT_TYPE_ORDER).toContain("SCENE");
    expect(DOCUMENT_TYPE_ORDER).toContain("OTHER");
  });

  test("CHARACTER appears before RELATIONSHIP in display order", () => {
    const charIndex = DOCUMENT_TYPE_ORDER.indexOf("CHARACTER");
    const relIndex = DOCUMENT_TYPE_ORDER.indexOf("RELATIONSHIP");
    expect(charIndex).toBeLessThan(relIndex);
  });

  test("DOCUMENT_SECTION_LABELS provides a label for every type in order", () => {
    DOCUMENT_TYPE_ORDER.forEach((type) => {
      expect(typeof DOCUMENT_SECTION_LABELS[type]).toBe("string");
      expect(DOCUMENT_SECTION_LABELS[type].length).toBeGreaterThan(0);
    });
  });

  test("DOCUMENT_TYPE_LABELS provides a label for every type in order", () => {
    DOCUMENT_TYPE_ORDER.forEach((type) => {
      expect(typeof DOCUMENT_TYPE_LABELS[type]).toBe("string");
      expect(DOCUMENT_TYPE_LABELS[type].length).toBeGreaterThan(0);
    });
  });
});
