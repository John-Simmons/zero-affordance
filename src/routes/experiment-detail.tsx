import { Link, useParams } from 'react-router'

import { Container } from '@/components/layout/container'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ExperimentRunner } from '@/features/experiments/experiment-runner'
import { HypothesisCard } from '@/features/experiments/hypothesis-card'
import { PairwiseRunner } from '@/features/experiments/pairwise-runner'
import { useExperiment } from '@/lib/data/hooks'
import { cn } from '@/lib/utils'

/**
 * Tighter above the title on a phone than below the page: the header sits right
 * there, so a full 48px gap reads as a gap rather than as breathing room, and it
 * is 48px of a short viewport spent before the experiment starts. Desktop keeps
 * the usual `py-12` the other routes use.
 */
const PAGE_PADDING = 'pt-6 pb-12 sm:pt-12'

export function ExperimentDetailPage() {
  const { slug = '' } = useParams()
  const { data: experiment, isLoading } = useExperiment(slug)

  if (isLoading) {
    return (
      <Container className={cn(PAGE_PADDING, 'max-w-2xl')}>
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
    <Container
      className={cn(PAGE_PADDING, isPairwise ? 'max-w-4xl' : 'max-w-2xl')}
    >
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

        {/*
          Pairwise runs render this themselves, so it can sit out the matchups —
          it is a spoiler-ish aside to read around the run, and during playback
          the participant is meant to be watching the loading states, not
          reading. Only the runner knows which phase it is in, hence the move.
        */}
        {!isPairwise && <HypothesisCard experiment={experiment} />}
      </div>
    </Container>
  )
}
