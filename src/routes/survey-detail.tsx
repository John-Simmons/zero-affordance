import { Link, useParams } from 'react-router'

import { Container } from '@/components/layout/container'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SurveyRunner } from '@/features/surveys/survey-runner'
import { useSurvey } from '@/lib/data/hooks'

export function SurveyDetailPage() {
  const { slug = '' } = useParams()
  const { data: survey, isLoading } = useSurvey(slug)

  if (isLoading) {
    return (
      <Container className="max-w-2xl py-12">
        <Skeleton className="mb-4 h-8 w-2/3" />
        <Skeleton className="h-96 w-full" />
      </Container>
    )
  }

  if (!survey) {
    return (
      <Container className="max-w-2xl py-24 text-center">
        <h1 className="text-2xl font-semibold">Survey not found</h1>
        <Button asChild variant="link" className="mt-2">
          <Link to="/surveys">Back to surveys</Link>
        </Button>
      </Container>
    )
  }

  return (
    <Container className="max-w-2xl py-12">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance">
          {survey.title}
        </h1>
        <p className="mt-2 text-pretty text-muted-foreground">
          {survey.description}
        </p>
      </header>
      <SurveyRunner survey={survey} />
    </Container>
  )
}
