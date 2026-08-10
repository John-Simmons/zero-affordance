import { Link } from 'react-router'
import { ArrowRight, FlaskConical, ListChecks } from 'lucide-react'

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
import { siteConfig } from '@/config/site'
import { useExperiments, useSurveys } from '@/lib/data/hooks'

export function HomePage() {
  const surveys = useSurveys()
  const experiments = useExperiments()

  return (
    <div>
      <section className="border-b border-border/60">
        <Container className="py-20 text-center">
          <Badge variant="secondary" className="mb-4">
            Companion to the YouTube channel
          </Badge>
          <h1 className="mx-auto max-w-3xl font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            {siteConfig.tagline}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-pretty text-muted-foreground">
            {siteConfig.description}
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/surveys">
                Take a survey <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/experiments">Run an experiment</Link>
            </Button>
          </div>
        </Container>
      </section>

      <Container className="grid gap-6 py-16 md:grid-cols-2">
        <SectionCard
          icon={<ListChecks className="size-5" />}
          title="Surveys"
          description="Quick self-reports whose results update live as the community responds."
          href="/surveys"
          cta="Browse surveys"
          count={surveys.data?.length}
        />
        <SectionCard
          icon={<FlaskConical className="size-5" />}
          title="Experiments"
          description="Interactive A/B-style studies on how design shapes perception and behavior."
          href="/experiments"
          cta="Browse experiments"
          count={experiments.data?.length}
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
