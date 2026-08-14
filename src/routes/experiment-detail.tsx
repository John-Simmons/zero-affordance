import { Link, useParams } from 'react-router'

import { Container } from '@/components/layout/container'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ExperimentRunner } from '@/features/experiments/experiment-runner'
import { PairwiseRunner } from '@/features/experiments/pairwise-runner'
import { useExperiment } from '@/lib/data/hooks'
import { cn } from '@/lib/utils'

export function ExperimentDetailPage() {
  const { slug = '' } = useParams()
  const { data: experiment, isLoading } = useExperiment(slug)

  if (isLoading) {
    return (
      <Container className="max-w-2xl py-12">
        <Skeleton className="mb-4 h-8 w-2/3" />
        <Skeleton className="h-96 w-full" />
      </Container>
    )
  }

  if (!experiment) {
    return (
      <Container className="max-w-2xl py-24 text-center">
        <h1 className="text-2xl font-semibold">Experiment not found</h1>
        <Button asChild variant="link" className="mt-2">
          <Link to="/experiments">Back to experiments</Link>
        </Button>
      </Container>
    )
  }

  // Pairwise experiments play their loading states in one full-width canvas;
  // max-w-2xl would leave it too cramped to host a realistic skeleton loader.
  const isPairwise = experiment.kind === 'pairwise'

  return (
    <Container className={cn('py-12', isPairwise ? 'max-w-4xl' : 'max-w-2xl')}>
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance">
          {experiment.title}
        </h1>
        {/*
          Pairwise runs render this inside `PairwiseIntro` instead, where it
          actually briefs the participant. Here it was pure header furniture,
          and on a phone its six lines pushed the vote buttons below the fold.

          Rating experiments have no intro card to move it to, so they keep it.
        */}
        {!isPairwise && (
          <p className="mt-2 text-pretty text-muted-foreground">
            {experiment.description}
          </p>
        )}
      </header>

      <div className="space-y-6">
        {isPairwise ? (
          <PairwiseRunner experiment={experiment} />
        ) : (
          <ExperimentRunner experiment={experiment} />
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">The hypothesis</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {experiment.hypothesis}
          </CardContent>
        </Card>
      </div>
    </Container>
  )
}
