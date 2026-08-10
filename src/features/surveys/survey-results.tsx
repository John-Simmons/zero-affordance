import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import type { Survey, SurveyAggregate } from '@/lib/data/types'

const chartConfig = {
  count: { label: 'Responses', color: 'var(--chart-1)' },
} satisfies ChartConfig

/** Live aggregate view for a survey, rendered per-question. */
export function SurveyResults({
  survey,
  aggregate,
  isLoading,
}: {
  survey: Survey
  aggregate: SurveyAggregate | undefined
  isLoading: boolean
}) {
  if (isLoading || !aggregate) {
    return <Skeleton className="h-64 w-full" />
  }

  return (
    <div className="grid gap-8">
      {survey.questions.map((q) => {
        const agg = aggregate.questions.find((x) => x.questionId === q.id)
        if (!agg) return null

        if (q.type === 'text') {
          return (
            <div key={q.id} className="space-y-2">
              <h3 className="text-sm font-medium">{q.prompt}</h3>
              {agg.textSamples && agg.textSamples.length > 0 ? (
                <ul className="space-y-2">
                  {agg.textSamples.map((t, i) => (
                    <li
                      key={i}
                      className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
                    >
                      “{t}”
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No responses yet — be the first.
                </p>
              )}
            </div>
          )
        }

        const data =
          q.type === 'scale'
            ? Object.entries(agg.scaleCounts ?? {})
                .map(([value, count]) => ({ label: value, count }))
                .sort((a, b) => Number(a.label) - Number(b.label))
            : (q.options ?? []).map((opt) => ({
                label: opt.label,
                count: agg.optionCounts?.[opt.id] ?? 0,
              }))

        return (
          <div key={q.id} className="space-y-2">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-sm font-medium">{q.prompt}</h3>
              {q.type === 'scale' && agg.scaleAverage !== undefined && (
                <span className="text-xs text-muted-foreground">
                  avg {agg.scaleAverage.toFixed(2)}
                </span>
              )}
            </div>
            <ChartContainer config={chartConfig} className="h-48 w-full">
              <BarChart accessibilityLayer data={data} layout="vertical">
                <CartesianGrid horizontal={false} />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={q.type === 'scale' ? 24 : 140}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12 }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
              </BarChart>
            </ChartContainer>
          </div>
        )
      })}
    </div>
  )
}
