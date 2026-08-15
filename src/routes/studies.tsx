import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

import { Container } from '@/components/layout/container'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useExperiments, useSurveys } from '@/lib/data/hooks'

/** One entry in the catalogue, flattened from either source. */
interface Study {
  /** Ids are only unique within a kind, so the kind has to be in the key. */
  key: string
  kind: 'Survey' | 'Experiment'
  title: string
  description: string
  /** "4 questions" / "6 variants" — what you are signing up for. */
  meta: string
  href: string
  cta: string
}

/**
 * Everything you can take part in, surveys and experiments together.
 *
 * The two listings this replaces were four meaningful lines apart, so keeping
 * them separate was duplicating a page to say the same thing twice.
 *
 * The kind badge is the whole reason a flat list works: a four-question survey
 * and a fifteen-matchup experiment are very different commitments, and
 * interleaving them without a visible label would hide that. The CTA verb
 * ("Start" vs "Participate") is the second signal.
 */
export function StudiesPage() {
  const surveys = useSurveys()
  const experiments = useExperiments()

  // Surveys first, then experiments, each in its own `position` order. Neither
  // summary carries a date, so there is no meaningful cross-kind sort to apply
  // — if curation matters later that is a `position` question, not a UI one.
  const studies: Study[] = [
    ...(surveys.data ?? []).map((s) => ({
      key: `survey:${s.id}`,
      kind: 'Survey' as const,
      title: s.title,
      description: s.description,
      meta: `${s.questionCount} questions`,
      href: `/surveys/${s.slug}`,
      cta: 'Start',
    })),
    ...(experiments.data ?? []).map((e) => ({
      key: `experiment:${e.id}`,
      kind: 'Experiment' as const,
      title: e.title,
      description: e.description,
      meta: `${e.variantCount} variants`,
      href: `/experiments/${e.slug}`,
      cta: 'Participate',
    })),
  ]

  // Gated on either query, not both: a half-populated grid that reflows when
  // the second resolves is worse than one beat of skeleton.
  const isLoading = surveys.isLoading || experiments.isLoading

  return (
    <Container className="py-12">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Studies
        </h1>
        <p className="mt-2 text-muted-foreground">
          Surveys to answer and experiments to take part in. Results update live
          as the community responds.
        </p>
      </header>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : studies.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nothing to take part in just yet — check back soon.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {studies.map((study) => (
            <Card key={study.key} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start gap-2">
                  <CardTitle>{study.title}</CardTitle>
                  <Badge variant="secondary" className="ml-auto shrink-0">
                    {study.kind}
                  </Badge>
                </div>
                <CardDescription>{study.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {study.meta}
                </span>
                <Button asChild size="sm">
                  <Link to={study.href}>
                    {study.cta} <ArrowRight />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </Container>
  )
}
