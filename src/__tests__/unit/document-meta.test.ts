import {
  isCharacterMeta,
  isRelationshipMeta,
  isWorldbuildingMeta,
} from "@/lib/document-meta";

describe("isCharacterMeta", () => {
  test("accepts valid CharacterMeta with role and isCanon", () => {
    expect(isCharacterMeta({ role: "Protagonist", isCanon: true })).toBe(true);
  });

  test("accepts CharacterMeta with only role", () => {
    expect(isCharacterMeta({ role: "Antagonist" })).toBe(true);
  });

  test("accepts empty object (all fields optional)", () => {
    expect(isCharacterMeta({})).toBe(true);
  });

  test("rejects non-object values", () => {
    expect(isCharacterMeta(null)).toBe(false);
    expect(isCharacterMeta("Protagonist")).toBe(false);
    expect(isCharacterMeta(42)).toBe(false);
  });

  test("rejects when role is not a string", () => {
    expect(isCharacterMeta({ role: 123 })).toBe(false);
  });

  test("rejects when isCanon is not a boolean", () => {
    expect(isCharacterMeta({ isCanon: "yes" })).toBe(false);
  });
});

describe("isRelationshipMeta", () => {
  test("accepts valid RelationshipMeta with characterIds and relationshipType", () => {
    expect(
      isRelationshipMeta({ characterIds: ["id-1", "id-2"], relationshipType: "Romantic" }),
    ).toBe(true);
  });

  test("accepts RelationshipMeta with only relationshipType", () => {
    expect(isRelationshipMeta({ relationshipType: "Family" })).toBe(true);
  });

  test("accepts empty object", () => {
    expect(isRelationshipMeta({})).toBe(true);
  });

  test("rejects non-object values", () => {
    expect(isRelationshipMeta(null)).toBe(false);
    expect(isRelationshipMeta("Family")).toBe(false);
  });

  test("rejects when characterIds is not an array of strings", () => {
    expect(isRelationshipMeta({ characterIds: [1, 2] })).toBe(false);
    expect(isRelationshipMeta({ characterIds: "id-1" })).toBe(false);
  });

  test("rejects when relationshipType is not a string", () => {
    expect(isRelationshipMeta({ relationshipType: true })).toBe(false);
  });
});

describe("isWorldbuildingMeta", () => {
  test("accepts valid WorldbuildingMeta with category and isCanon", () => {
    expect(isWorldbuildingMeta({ category: "Location", isCanon: false })).toBe(true);
  });

  test("accepts WorldbuildingMeta with only category", () => {
    expect(isWorldbuildingMeta({ category: "Culture" })).toBe(true);
  });

  test("accepts empty object", () => {
    expect(isWorldbuildingMeta({})).toBe(true);
  });

  test("rejects non-object values", () => {
    expect(isWorldbuildingMeta(null)).toBe(false);
    expect(isWorldbuildingMeta("Location")).toBe(false);
  });

  test("rejects when category is not a string", () => {
    expect(isWorldbuildingMeta({ category: 42 })).toBe(false);
  });

  test("rejects when isCanon is not a boolean", () => {
    expect(isWorldbuildingMeta({ isCanon: "true" })).toBe(false);
  });
});
