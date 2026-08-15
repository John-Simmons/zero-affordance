import { ArrowRight, FlaskConical, Lightbulb } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'

import { Container } from '@/components/layout/container'
import { Logo } from '@/components/layout/logo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { siteConfig } from '@/config/site'
import { useExperiments, useSurveys, useVideoIdeas } from '@/lib/data/hooks'
import { getVisitorId } from '@/lib/visitor'

export function HomePage() {
  const surveys = useSurveys()
  const experiments = useExperiments()

  // Same read-once-per-mount rule as the ideas page: the id is a query key, so
  // a fresh value each render would thrash the cache.
  const visitorId = useMemo(() => getVisitorId(), [])
  const ideas = useVideoIdeas(visitorId)

  // Only meaningful once both catalogue queries have landed — a badge that
  // counts half the studies is worse than no badge for a beat.
  const studyCount =
    surveys.data && experiments.data
      ? surveys.data.length + experiments.data.length
      : undefined

  return (
    <div>
      <section className="border-b border-border/60">
        <Container className="py-20 text-center">
          <Logo className="mx-auto mb-6 block h-12" />
          <h1 className="mx-auto max-w-3xl font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            {siteConfig.tagline}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-pretty text-muted-foreground">
            {siteConfig.description}
          </p>
        </Container>
      </section>

      {/*
        One card per destination in the nav's two content sections. The old
        Surveys/Experiments split predates the combined catalogue and had both
        cards pointing at /studies, which read as a duplicated link.
      */}
      <Container className="grid gap-6 py-16 md:grid-cols-2">
        <SectionCard
          icon={<FlaskConical className="size-5" />}
          title="Studies"
          description="Surveys to answer and experiments to take part in, with results that update live as the community responds."
          href="/studies"
          cta="Browse studies"
          count={studyCount}
        />
        <SectionCard
          icon={<Lightbulb className="size-5" />}
          title="Video Ideas"
          description="Suggest what the channel should cover next, and vote for the topics you want to watch."
          href="/ideas"
          cta="See the ideas"
          count={ideas.data?.length}
        />
      </Container>
    </div>
  )
}

function SectionCard({
  icon,
  title,
  description,
  href,
  cta,
  count,
}: {
  icon: React.ReactNode
  title: string
  description: string
  href: string
  cta: string
  count: number | undefined
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <CardTitle>{title}</CardTitle>
          {count !== undefined && (
            <Badge variant="secondary" className="ml-auto">
              {count}
            </Badge>
          )}
        </div>
        <CardDescription className="pt-1">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="secondary">
          <Link to={href}>
            {cta} <ArrowRight />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
