import type { ReactNode } from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { START_RATING } from '@/lib/data/aggregate'
import type { EloAggregate, EloRating } from '@/lib/data/types'

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
  renderLabel,
  chart,
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
  /**
   * Wraps the variant name, for callers that can make it do more than sit
   * there. Defaults to plain text.
   *
   * Inverted rather than reaching for the indicator components directly: this
   * table renders from an `EloAggregate` and nothing else, and an aggregate
   * carries no `description` and no duration. Only the caller holds the seeded
   * variants, so only the caller can build a preview worth showing.
   */
  renderLabel?: (rating: EloRating) => ReactNode
  /**
   * A second view of the same standings, shown behind a tab beside the table.
   *
   * Passed in rather than built here, for the same reason as `renderLabel`
   * above: this component renders from an `EloAggregate` and nothing else, and
   * a trajectory needs the seeded variants the aggregate doesn't carry. Omitted,
   * the table renders alone with no tabs at all — a lone tab strip over a single
   * view is just a label pretending to be a control.
   */
  chart?: ReactNode
}) {
  if (isLoading || !aggregate) return <Skeleton className="h-64 w-full" />

  /*
    Capped rather than full-width. The card is max-w-4xl to give the stimulus
    canvas room, but a handful of short columns stretched across that leaves the
    unconstrained name column absorbing ~350px of empty space, pushing the
    rating far from the label it belongs to.

    No overflow wrapper here — shadcn's Table already renders one.

    Both numeric columns align left, against the convention for numbers, because
    the rating carries a trailing delta. Right-aligned, the pair was aligned as a
    unit, so a row ending "(±0)" and one ending "(−12)" put their ratings in
    different places — lined up with neither each other nor the "Elo rating"
    header. Aligned left, the rating leads the cell, so every rating and its
    header start on one edge whatever follows them.
  */
  const table = (
    <Table className="mx-auto max-w-md">
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">#</TableHead>
          <TableHead>Loading state</TableHead>
          <TableHead className="w-28">Elo rating</TableHead>
          <TableHead className="w-20">W–D–L</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {aggregate.ratings.map((r, i) => (
          <TableRow key={r.variantId}>
            <TableCell className="text-muted-foreground tabular-nums">
              {i + 1}
            </TableCell>
            <TableCell className="font-medium">
              {renderLabel ? renderLabel(r) : r.label}
            </TableCell>
            <TableCell className="tabular-nums">
              {/*
                The width floor is what keeps the deltas aligned with each
                other and not merely the ratings: `tabular-nums` equalises
                digit widths but not digit counts, so a rating that ever fell
                to three figures would drag its delta a character left. It
                doubles as the gap, and the literal space keeps the cell
                reading "1520 (+12)" rather than "1520(+12)".
              */}
              <span className="inline-block min-w-10">
                {Math.round(r.rating)}
              </span>
              {deltas && (
                <>
                  {' '}
                  <RatingDelta delta={deltas[r.variantId] ?? 0} />
                </>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground tabular-nums">
              {r.wins}–{r.ties}–{r.losses}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )

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
        No tabs when there is only the table to show: a tab strip with one tab
        is a label wearing a control's clothes. The table stays the default view
        — it is the precise answer, and the chart is the context for it.
      */}
      {chart ? (
        <Tabs defaultValue="table">
          <TabsList>
            <TabsTrigger value="table">Standings</TabsTrigger>
            <TabsTrigger value="chart">Over time</TabsTrigger>
          </TabsList>
          <TabsContent value="table">{table}</TabsContent>
          {/*
            Radix mounts only the active panel, which is what the chart needs:
            recharts measures its container on mount, and a hidden one has no
            width to measure.
          */}
          <TabsContent value="chart">{chart}</TabsContent>
        </Tabs>
      ) : (
        table
      )}
    </div>
  )
}
