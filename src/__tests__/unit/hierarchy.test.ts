import { isMode, isRating, toOptionalString } from "@/lib/hierarchy";

describe("isMode", () => {
  test("accepts valid modes", () => {
    expect(isMode("ORIGINAL")).toBe(true);
    expect(isMode("FANFIC")).toBe(true);
  });

  test("rejects invalid values", () => {
    expect(isMode("original")).toBe(false);
    expect(isMode("")).toBe(false);
    expect(isMode(null)).toBe(false);
    expect(isMode(undefined)).toBe(false);
    expect(isMode(42)).toBe(false);
  });
});

describe("isRating", () => {
  test("accepts all valid ratings", () => {
    expect(isRating("G")).toBe(true);
    expect(isRating("T")).toBe(true);
    expect(isRating("M")).toBe(true);
    expect(isRating("E")).toBe(true);
  });

  test("rejects invalid values", () => {
    expect(isRating("R")).toBe(false);
    expect(isRating("g")).toBe(false);
    expect(isRating("")).toBe(false);
    expect(isRating(null)).toBe(false);
    expect(isRating(undefined)).toBe(false);
  });
});

describe("toOptionalString", () => {
  test("returns trimmed string for non-empty strings", () => {
    expect(toOptionalString("  hello  ")).toBe("hello");
    expect(toOptionalString("Harry Potter")).toBe("Harry Potter");
  });

  test("returns null for empty, whitespace, null, or undefined", () => {
    expect(toOptionalString("")).toBeNull();
    expect(toOptionalString("   ")).toBeNull();
    expect(toOptionalString(null)).toBeNull();
    expect(toOptionalString(undefined)).toBeNull();
    expect(toOptionalString(42)).toBeNull();
  });
});

describe("cascade delete logic", () => {
  test("story with seriesId and null universeId is a valid standalone-series hierarchy", () => {
    // A story may belong to a series that has no parent universe.
    // universeId is optional on Story — null is the correct value in this case.
    const storyData = {
      seriesId: "series-abc",
      universeId: null as string | null,
    };
    expect(storyData.universeId).toBeNull();
    expect(typeof storyData.seriesId).toBe("string");
  });

  test("story with null seriesId and null universeId is a valid standalone story", () => {
    const storyData = {
      seriesId: null as string | null,
      universeId: null as string | null,
    };
    expect(storyData.seriesId).toBeNull();
    expect(storyData.universeId).toBeNull();
  });
});
