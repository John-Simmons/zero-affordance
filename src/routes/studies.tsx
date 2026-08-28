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

/**
 * The bottom-left line of a card: how many people have taken part so far.
 *
 * Spells the empty case out rather than showing "0 participants". Nobody has
 * answered yet is an invitation; a zero next to a count reads as a study that
 * failed to attract anyone.
 */
function participants(count: number): string {
  if (count === 0) return 'No participants yet'
  return `${count} participant${count === 1 ? '' : 's'}`
}

/** One entry in the catalogue, flattened from either source. */
interface Study {
  /** Ids are only unique within a kind, so the kind has to be in the key. */
  key: string
  kind: 'Survey' | 'Experiment'
  title: string
  description: string
  /** "12 participants" — how much company you would be joining. */
  meta: string
  href: string
  cta: string
  /**
   * Where "Skip to results" goes, for the kinds that have a results view to
   * skip to. Surveys leave it undefined and get the one button they had.
   */
  resultsHref?: string
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
 *
 * The line under it counts participants rather than questions or variants: the
 * badge already says which kind of commitment this is, and how many people are
 * already in is the thing a visitor cannot find out anywhere else on the page.
 * The exact question or variant count is on the study's own page.
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
      meta: participants(s.participantCount),
      href: `/surveys/${s.slug}`,
      cta: 'Start',
    })),
    ...(experiments.data ?? []).map((e) => ({
      key: `experiment:${e.id}`,
      kind: 'Experiment' as const,
      title: e.title,
      description: e.description,
      meta: participants(e.participantCount),
      href: `/experiments/${e.slug}`,
      cta: 'Participate',
      // The same jump the experiment's own intro card offers, hoisted to the
      // catalogue: someone who only wants the standings had to start a run and
      // opt out of it from the inside to find out that was allowed.
      resultsHref: `/experiments/${e.slug}?view=results`,
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
        // Same one-per-row rhythm as the cards, so nothing reflows sideways
        // when the queries land.
        <div className="grid gap-4">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : studies.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nothing to take part in just yet — check back soon.
          </CardContent>
        </Card>
      ) : (
        // One per row at every width. Two columns made each card narrow enough
        // that the description wrapped to four lines and the footer's two
        // buttons wrapped below the participant count; full width gives the
        // description its line and puts the count and both buttons on one row.
        <div className="grid gap-4">
          {studies.map((study) => (
            // No `flex flex-col`: `Card` is already a column, and the class was
            // only there to make `mt-auto` below pin the footer to the bottom
            // of a stretched grid cell. Nothing stretches in one column.
            <Card key={study.key}>
              <CardHeader>
                <div className="flex items-start gap-2">
                  <CardTitle>{study.title}</CardTitle>
                  <Badge variant="secondary" className="ml-auto shrink-0">
                    {study.kind}
                  </Badge>
                </div>
                <CardDescription>{study.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">
                  {study.meta}
                </span>
                {/* Wrapping as a pair, so a narrow phone drops both buttons
                    below the meta line rather than splitting them across it. */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild size="sm">
                    <Link to={study.href}>
                      {study.cta} <ArrowRight />
                    </Link>
                  </Button>
                  {/* Primary first, outline second — the same order, and the
                      same two choices, as the experiment's intro card. */}
                  {study.resultsHref && (
                    <Button asChild size="sm" variant="outline">
                      <Link to={study.resultsHref}>
                        Skip to results <ArrowRight />
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </Container>
  )
}
