import { shouldShowAgeGate } from "@/lib/age-gate";

describe("shouldShowAgeGate", () => {
  test("returns true when explicitEnabled is false and rating is E", () => {
    expect(shouldShowAgeGate(false, "E")).toBe(true);
  });

  test("returns false when explicitEnabled is true and rating is E", () => {
    expect(shouldShowAgeGate(true, "E")).toBe(false);
  });

  test("returns false for G rating regardless of explicitEnabled", () => {
    expect(shouldShowAgeGate(false, "G")).toBe(false);
    expect(shouldShowAgeGate(true, "G")).toBe(false);
  });

  test("returns false for T rating regardless of explicitEnabled", () => {
    expect(shouldShowAgeGate(false, "T")).toBe(false);
    expect(shouldShowAgeGate(true, "T")).toBe(false);
  });

  test("returns false for M rating regardless of explicitEnabled", () => {
    expect(shouldShowAgeGate(false, "M")).toBe(false);
    expect(shouldShowAgeGate(true, "M")).toBe(false);
  });
});
