import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart'
import { EloHistoryTooltip } from '@/features/experiments/elo-history-tooltip'
import {
  SeriesSwatch,
  seriesColorAt,
} from '@/features/experiments/series-colors'
import { Skeleton } from '@/components/ui/skeleton'
import { START_RATING } from '@/lib/data/aggregate'
import type { EloHistory, Experiment } from '@/lib/data/types'

/**
 * Names this chart, so the legend below it can share its palette.
 *
 * `ChartStyle` emits the `--color-<key>` variables against `[data-chart=<id>]`,
 * a plain attribute selector in a document-level stylesheet — so any element
 * carrying that attribute inherits the same colours, wherever it sits in the
 * tree. That is what lets the legend live outside the chart (see the note on
 * it) and still paint from one source. An explicit id rather than the generated
 * one is what makes the value knowable out here.
 */
const CHART_ID = 'elo-history'

/**
 * How each loading state's Elo has moved as matchups accumulated.
 *
 * The x-axis counts matchups rather than calendar days: ratings are derived by
 * replaying an ordered match log, and the mock provider's synthetic prehistory
 * carries no timestamps at all, so a date axis would be part invention. Matchup
 * count is the real independent variable either way — it is what actually moves
 * a rating.
 */
export function EloHistoryChart({
  experiment,
  history,
  isLoading,
}: {
  experiment: Experiment
  history: EloHistory | undefined
  isLoading: boolean
}) {
  // Colour follows the variant's declared position, never its rank — see
  // `seriesColorAt`.
  const chartConfig = useMemo<ChartConfig>(
    () =>
      Object.fromEntries(
        experiment.variants.map((v, i) => [
          v.id,
          { label: v.label, theme: seriesColorAt(i) },
        ]),
      ),
    [experiment.variants],
  )

  // Recharts wants one flat row per point; the domain type keeps the ratings in
  // their own map so a variant id can never collide with `matchCount`.
  const data = useMemo(
    () =>
      (history?.points ?? []).map((p) => ({
        matchCount: p.matchCount,
        ...Object.fromEntries(
          Object.entries(p.ratings).map(([id, r]) => [id, Math.round(r)]),
        ),
      })),
    [history],
  )

  // Matches the standings table's own loading treatment.
  if (isLoading || !history) return <Skeleton className="h-72 w-full" />

  if (history.totalMatches === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No matchups recorded yet — every loading state is still on{' '}
        {START_RATING}.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <ChartContainer
        id={CHART_ID}
        config={chartConfig}
        className="h-72 w-full"
      >
        <LineChart
          accessibilityLayer
          data={data}
          margin={{ left: 4, right: 12 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="matchCount"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            domain={['auto', 'auto']}
            width={40}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12 }}
          />
          {/* Everything starts here, so the line makes the spread legible at a
            glance: above it is better than average, below it worse. */}
          <ReferenceLine y={START_RATING} strokeDasharray="4 4" />
          {/*
          Bespoke content, not shadcn's: this one ranks the rows highest-first
          and animates them past each other. `itemSorter` looks like it would do
          the ranking, but recharts only reads it inside its own default
          tooltip — a custom `content` is handed the payload unsorted.
        */}
          <ChartTooltip
            content={<EloHistoryTooltip variants={experiment.variants} />}
          />
          {experiment.variants.map((v) => (
            <Line
              key={v.id}
              dataKey={v.id}
              name={v.id}
              stroke={`var(--color-${v.id})`}
              strokeWidth={2}
              dot={false}
              // Linear, not monotone: Elo moves in discrete steps, and smoothing
              // would draw ratings that never existed between two points.
              type="linear"
            />
          ))}
        </LineChart>
      </ChartContainer>
      {/*
        Ours, and outside the chart, because recharts' own legend cannot be
        trusted to reserve its space here. It measures the legend box once,
        through a ref callback with no ResizeObserver behind it
        (`useElementOffset`), and reserves that height at the bottom of the
        plot. A legend that reflows afterwards — six labels going from one row
        to three as the viewport narrows — is never re-measured, so the space
        stays as it was and the extra rows print straight over the x-axis.

        In normal flow under the chart there is nothing to measure and nothing
        to overlap: the rows simply take the height they need and push the card
        down. Its swatches paint from `SeriesSwatch`, the same array `ChartStyle`
        strokes the lines from — so the key matches the plot without depending on
        being inside it, which is what lets the standings table draw the same
        chips a card away.

        Two aligned columns on a phone, one centred row from sm. Six labels of
        unequal length wrapped into a centred row leave every line a different
        width and a different starting offset — ragged in a way that reads as a
        mistake rather than as a key. A grid gives them a common left edge and
        pairs them off; from sm there is room for the single row, where centring
        under the plot is the better look.
      */}
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:flex sm:flex-wrap sm:justify-center">
        {experiment.variants.map((v, i) => (
          <li key={v.id} className="flex items-center gap-1.5">
            <SeriesSwatch index={i} className="size-2" />
            {v.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
