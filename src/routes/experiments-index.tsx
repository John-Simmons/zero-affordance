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
import { useExperiments } from '@/lib/data/hooks'

export function ExperimentsIndexPage() {
  const { data, isLoading } = useExperiments()

  return (
    <Container className="py-12">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Experiments
        </h1>
        <p className="mt-2 text-muted-foreground">
          Interactive studies on perception, behavior, and design.
        </p>
      </header>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data?.map((exp) => (
            <Card key={exp.id} className="flex flex-col">
              <CardHeader>
                <CardTitle>{exp.title}</CardTitle>
                <CardDescription>{exp.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {exp.variantCount} variants
                </span>
                <Button asChild size="sm">
                  <Link to={`/experiments/${exp.slug}`}>
                    Participate <ArrowRight />
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
