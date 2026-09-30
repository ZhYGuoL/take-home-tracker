/**
 * Keeps the rows where they were while she works, so a row she just changed does not jump.
 * Rows that are new go on top, in their sorted order. Rows that left are dropped.
 */
export function stableOrder(previous: readonly string[], sorted: readonly string[]): string[] {
  const now = new Set(sorted)
  const before = new Set(previous)
  const added = sorted.filter((id) => !before.has(id))
  const kept = previous.filter((id) => now.has(id))
  return [...added, ...kept]
}
