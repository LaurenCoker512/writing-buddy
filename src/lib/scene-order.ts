const DEFAULT_GAP = 1000;

/**
 * Computes a Float order value for an item being inserted at newIndex
 * within a list of existing items. Items with null order are treated as
 * having implicit values of (index + 1) * DEFAULT_GAP.
 *
 * Guarantees the returned value is strictly between its neighbors.
 */
export function calculateInsertOrder(
  sortedOrders: (number | null)[],
  newIndex: number,
): number {
  const resolved = sortedOrders.map((o, i) => o ?? (i + 1) * DEFAULT_GAP);
  const before = resolved[newIndex - 1];
  const after = resolved[newIndex];

  if (before === undefined && after === undefined) return DEFAULT_GAP;
  if (before === undefined) return after - DEFAULT_GAP;
  if (after === undefined) return before + DEFAULT_GAP;
  return (before + after) / 2;
}
