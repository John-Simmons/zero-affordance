import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ExperimentResults } from '@/features/experiments/experiment-results'
import {
  useAssignedVariant,
  useExperimentAggregate,
  useRecordInteraction,
} from '@/lib/data/hooks'
import type { Experiment, ExperimentVariant } from '@/lib/data/types'
import { cn } from '@/lib/utils'
import { getVisitorId } from '@/lib/visitor'

/**
 * Renders the stimulus for a variant of a *rating* experiment.
 *
 * Dormant: the only rating experiment, "button-affordance", was a placeholder
 * and has been retired, so nothing currently reaches this file. It is kept
 * deliberately rather than deleted — the whole rating path (this runner,
 * `assignVariant`, `recordInteraction`, `aggregateExperiment` and the
 * `experiment_interactions` table) still works and is waiting for the next
 * rating-style experiment. The `solid`/`flat` cases below are what that
 * retired experiment used; they are the worked example, not live content.
 *
 * Add cases here as you author new experiments.
 */
function VariantStimulus({ variant }: { variant: ExperimentVariant }) {
  if (variant.id === 'solid') {
    return <Button size="lg">Start the tour</Button>
  }
  if (variant.id === 'flat') {
    return (
      <span className="cursor-pointer text-base text-foreground select-none">
        Start the tour
      </span>
    )
  }
  return (
    <div className="rounded-md border p-4 text-sm">{variant.description}</div>
  )
}

export function ExperimentRunner({ experiment }: { experiment: Experiment }) {
  const visitorId = getVisitorId()
  const assigned = useAssignedVariant(experiment.id, visitorId)
  const record = useRecordInteraction()
  const [rating, setRating] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const aggregate = useExperimentAggregate(
    submitted ? experiment.id : undefined,
  )

  const variant = assigned.data

  const submit = () => {
    if (!variant || rating == null) return
    record.mutate(
      {
        experimentId: experiment.id,
        variantId: variant.id,
        visitorId,
        value: rating,
      },
      {
        onSuccess: () => {
          setSubmitted(true)
          toast.success('Recorded. See how your rating compares below.')
        },
        onError: () => toast.error('Could not record your rating.'),
      },
    )
  }

  if (submitted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Results across variants</CardTitle>
        </CardHeader>
        <CardContent>
          <ExperimentResults
            experiment={experiment}
            aggregate={aggregate.data}
            isLoading={aggregate.isLoading}
          />
          <p className="mt-4 text-xs text-muted-foreground">
            You saw the <span className="font-medium">{variant?.label}</span>{' '}
            variant.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Try it</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {assigned.isLoading || !variant ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            <div className="flex min-h-32 items-center justify-center rounded-lg border bg-muted/40 p-8">
              <VariantStimulus variant={variant} />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">{experiment.metricLabel}</p>
              <div className="flex flex-wrap gap-2">
                {Array.from(
                  { length: experiment.metricMax - experiment.metricMin + 1 },
                  (_, i) => experiment.metricMin + i,
                ).map((n) => (
                  <Button
                    key={n}
                    type="button"
                    variant={rating === n ? 'default' : 'outline'}
                    size="icon"
                    className={cn('size-10 text-base')}
                    onClick={() => setRating(n)}
                    aria-pressed={rating === n}
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              onClick={submit}
              disabled={rating == null || record.isPending}
            >
              {record.isPending ? 'Recording…' : 'Submit rating'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
