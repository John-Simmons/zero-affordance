import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import type { Experiment, ExperimentAggregate } from '@/lib/data/types'

const chartConfig = {
  average: { label: 'Average rating', color: 'var(--chart-1)' },
} satisfies ChartConfig

/** Compares the outcome metric across experiment variants. */
export function ExperimentResults({
  experiment,
  aggregate,
  isLoading,
}: {
  experiment: Experiment
  aggregate: ExperimentAggregate | undefined
  isLoading: boolean
}) {
  if (isLoading || !aggregate) {
    return <Skeleton className="h-56 w-full" />
  }

  const data = aggregate.variants.map((v) => ({
    label: v.label,
    average: Number(v.average.toFixed(2)),
    count: v.count,
  }))

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {experiment.metricLabel} · {aggregate.totalInteractions} ratings
      </p>
      <ChartContainer config={chartConfig} className="h-56 w-full">
        <BarChart accessibilityLayer data={data} margin={{ top: 24 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            domain={[experiment.metricMin, experiment.metricMax]}
            tickLine={false}
            axisLine={false}
            width={24}
            tick={{ fontSize: 12 }}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="average" fill="var(--color-average)" radius={6}>
            <LabelList dataKey="average" position="top" className="text-xs" />
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  )
}
