/**
 * Where each id places when ranked by value, highest first.
 *
 * Its own module so the tooltip file exports only a component: a mixed module
 * costs React Fast Refresh, which is what `react(only-export-components)` warns
 * about.
 *
 * Ties fall back to `order`, which is what stops two loading states on the same
 * rating from swapping places on every mouse move as the cursor sweeps. They all
 * open on the same rating, so that case is the left-hand edge of every chart.
 */
export function rankByValue(
  order: string[],
  values: Record<string, number>,
): Map<string, number> {
  return new Map(
    order
      .map((id, i) => ({ id, i }))
      .sort((a, b) => (values[b.id] ?? 0) - (values[a.id] ?? 0) || a.i - b.i)
      .map(({ id }, rank) => [id, rank]),
  )
}
