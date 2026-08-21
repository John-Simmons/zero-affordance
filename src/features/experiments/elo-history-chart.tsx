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
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart'
import { EloHistoryTooltip } from '@/features/experiments/elo-history-tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { START_RATING } from '@/lib/data/aggregate'
import type { EloHistory, Experiment } from '@/lib/data/types'

/**
 * Six categorical hues, one per loading state, in fixed slot order.
 *
 * Declared here rather than as `--chart-*` tokens in `index.css` on purpose.
 * The site palette is deliberately achromatic — it reserves its only two
 * chromatic tokens for signed values — and its `--chart-1..5` ramp is five
 * greys, identical in light and dark, which six overlapping lines cannot be
 * read from. shadcn's `ChartConfig` takes a per-series `{ light, dark }` pair
 * and `ChartStyle` emits the `.dark` rule for it, so these still follow the
 * theme without the rest of the site gaining colour it does not want.
 *
 * Validated as a set (not picked by eye) against this card's real surfaces,
 * white and `oklch(0.205 0 0)`: every adjacent pair clears the colour-blind
 * separation and normal-vision floors in both themes. Three of the light steps
 * fall below 3:1 against white, which is allowed only because identity is never
 * carried by colour alone here — the legend labels every line, and the full
 * table sits one tab away. Re-run the check before touching any of these.
 */
const SERIES_COLORS = [
  { light: '#2a78d6', dark: '#3987e5' },
  { light: '#eb6834', dark: '#d95926' },
  { light: '#1baf7a', dark: '#199e70' },
  { light: '#eda100', dark: '#c98500' },
  { light: '#e87ba4', dark: '#d55181' },
  { light: '#008300', dark: '#008300' },
]

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
  // Colour follows the variant's declared position, never its rank. Keyed off
  // the standings instead, every line would change colour the moment two
  // loading states swapped places.
  const chartConfig = useMemo<ChartConfig>(
    () =>
      Object.fromEntries(
        experiment.variants.map((v, i) => [
          v.id,
          {
            label: v.label,
            theme: SERIES_COLORS[i % SERIES_COLORS.length],
          },
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
    <ChartContainer config={chartConfig} className="h-72 w-full">
      <LineChart accessibilityLayer data={data} margin={{ left: 4, right: 12 }}>
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
        <ChartLegend content={<ChartLegendContent className="flex-wrap" />} />
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
  )
}
