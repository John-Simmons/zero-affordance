import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'

import { Container } from '@/components/layout/container'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useSurveys } from '@/lib/data/hooks'

export function SurveysIndexPage() {
  const { data, isLoading } = useSurveys()

  return (
    <Container className="py-12">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Surveys
        </h1>
        <p className="mt-2 text-muted-foreground">
          Share your experience and watch the aggregate results evolve.
        </p>
      </header>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data?.map((survey) => (
            <Card key={survey.id} className="flex flex-col">
              <CardHeader>
                <CardTitle>{survey.title}</CardTitle>
                <CardDescription>{survey.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {survey.questionCount} questions
                </span>
                <Button asChild size="sm">
                  <Link to={`/surveys/${survey.slug}`}>
                    Start <ArrowRight />
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
