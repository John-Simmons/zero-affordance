import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { START_RATING } from '@/lib/data/aggregate'
import type { EloAggregate } from '@/lib/data/types'

/**
 * The participant's own effect on one rating.
 *
 * The explicit sign carries the meaning on its own, so colour is never the only
 * signal — this reads correctly for colour-blind participants and in greyscale.
 */
function RatingDelta({ delta }: { delta: number }) {
  const rounded = Math.round(delta)
  if (rounded === 0) {
    return <span className="text-muted-foreground">(±0)</span>
  }
  return (
    <span className={rounded > 0 ? 'text-success' : 'text-destructive'}>
      ({rounded > 0 ? '+' : '−'}
      {Math.abs(rounded)})
    </span>
  )
}

export function EloResults({
  aggregate,
  isLoading,
  deltas,
  voteCount,
}: {
  aggregate: EloAggregate | undefined
  isLoading: boolean
  /** This run's effect per variant. Omitted when it can't be established. */
  deltas?: Record<string, number>
  /**
   * How many votes this run recorded. Passed in rather than written into the
   * copy: the count is C(variants, 2), so it changed from ten to fifteen the
   * moment a sixth indicator was added, and a hardcoded number goes stale
   * silently.
   */
  voteCount?: number
}) {
  if (isLoading || !aggregate) return <Skeleton className="h-64 w-full" />

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Elo rating across {aggregate.totalMatches.toLocaleString()} matchups
        from everyone who has played. Ratings start at {START_RATING} and are
        adjusted for how long each animation actually ran — winning while
        shorter earns less.
        {deltas &&
          voteCount !== undefined &&
          ` The bracketed figure is what your ${voteCount} votes just changed.`}
      </p>

      {/*
        Capped rather than full-width. The card is max-w-4xl to give the
        stimulus canvas room, but four short columns stretched across that
        leaves the unconstrained name column absorbing ~350px of empty space,
        pushing the rating far from the label it belongs to.

        No overflow wrapper here — shadcn's Table already renders one.
      */}
      <Table className="mx-auto max-w-md">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Loading state</TableHead>
            <TableHead className="w-28 text-right">Rating</TableHead>
            <TableHead className="w-20 text-right">W–D–L</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {aggregate.ratings.map((r, i) => (
            <TableRow key={r.variantId}>
              <TableCell className="text-muted-foreground tabular-nums">
                {i + 1}
              </TableCell>
              <TableCell className="font-medium">{r.label}</TableCell>
              <TableCell className="text-right tabular-nums">
                {Math.round(r.rating)}
                {deltas && (
                  <>
                    {' '}
                    <RatingDelta delta={deltas[r.variantId] ?? 0} />
                  </>
                )}
              </TableCell>
              <TableCell className="text-right text-muted-foreground tabular-nums">
                {r.wins}–{r.ties}–{r.losses}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
