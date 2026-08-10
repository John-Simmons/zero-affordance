import { Link, useParams } from 'react-router'

import { Container } from '@/components/layout/container'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ExperimentRunner } from '@/features/experiments/experiment-runner'
import { useExperiment } from '@/lib/data/hooks'

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

  return (
    <Container className="max-w-2xl py-12">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance">
          {experiment.title}
        </h1>
        <p className="mt-2 text-pretty text-muted-foreground">
          {experiment.description}
        </p>
      </header>

      <div className="space-y-6">
        <ExperimentRunner experiment={experiment} />

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
