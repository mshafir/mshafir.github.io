/**
 * Subsequence match with a contiguity bonus. Returns null when the query's
 * characters do not appear in `target` in order; otherwise a score where
 * higher is better.
 */
export function fuzzyScore(query: string, target: string): number | null {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  if (q.length === 0) return 0

  let score = 0
  let targetIndex = 0
  let previousMatch = -2

  for (const char of q) {
    const found = t.indexOf(char, targetIndex)
    if (found === -1) return null
    // Reward adjacency, and reward matching near the start of the target.
    if (found === previousMatch + 1) score += 8
    if (found === 0) score += 6
    score += Math.max(0, 4 - found * 0.1)
    previousMatch = found
    targetIndex = found + 1
  }

  return score
}
