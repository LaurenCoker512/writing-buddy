import { estimateContradictionTokens } from "@/lib/contradiction";
import type { DocForCheck } from "@/lib/contradiction";

describe("estimateContradictionTokens", () => {
  test("returns a non-zero positive integer for non-empty docs", () => {
    const docs: DocForCheck[] = [
      { name: "Aria", type: "CHARACTER", content: "A brave warrior who seeks justice." },
      { name: "Chapter 1", type: "PLOT", content: "The villain seeks revenge on the kingdom." },
    ];
    const estimate = estimateContradictionTokens(docs);
    expect(estimate).toBeGreaterThan(0);
    expect(Number.isInteger(estimate)).toBe(true);
  });

  test("returns 0 for empty document list", () => {
    expect(estimateContradictionTokens([])).toBe(0);
  });

  test("estimate grows with more content", () => {
    const small: DocForCheck[] = [{ name: "A", type: "CHARACTER", content: "Short." }];
    const large: DocForCheck[] = [{ name: "A", type: "CHARACTER", content: "x".repeat(4000) }];
    expect(estimateContradictionTokens(large)).toBeGreaterThan(estimateContradictionTokens(small));
  });

  test("estimate includes document name and type in calculation", () => {
    const withName: DocForCheck[] = [{ name: "Aria the Warrior Queen", type: "CHARACTER", content: "." }];
    const withoutName: DocForCheck[] = [{ name: "A", type: "CHARACTER", content: "." }];
    expect(estimateContradictionTokens(withName)).toBeGreaterThan(
      estimateContradictionTokens(withoutName),
    );
  });
});
