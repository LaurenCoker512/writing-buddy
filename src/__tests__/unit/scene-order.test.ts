import { calculateInsertOrder } from "@/lib/scene-order";

describe("calculateInsertOrder", () => {
  test("inserting between two scenes returns midpoint of their order values", () => {
    const orders = [1000, 3000];
    const result = calculateInsertOrder(orders, 1);
    expect(result).toBe(2000);
    expect(result).toBeGreaterThan(1000);
    expect(result).toBeLessThan(3000);
  });

  test("inserting at the beginning returns a value less than the first item", () => {
    const result = calculateInsertOrder([1000, 2000, 3000], 0);
    expect(result).toBeLessThan(1000);
  });

  test("inserting at the end returns a value greater than the last item", () => {
    const result = calculateInsertOrder([1000, 2000, 3000], 3);
    expect(result).toBeGreaterThan(3000);
  });

  test("inserting into an empty list returns the default gap value", () => {
    const result = calculateInsertOrder([], 0);
    expect(result).toBe(1000);
  });

  test("null order values are treated as index-based defaults", () => {
    // null at index 0 → 1000, null at index 1 → 2000; insert between = 1500
    const result = calculateInsertOrder([null, null], 1);
    expect(result).toBe(1500);
    expect(result).toBeGreaterThan(1000);
    expect(result).toBeLessThan(2000);
  });

  test("result is a float for non-integer midpoints", () => {
    const result = calculateInsertOrder([1000, 1001], 1);
    expect(result).toBe(1000.5);
  });
});
