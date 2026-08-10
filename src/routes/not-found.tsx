import { Link } from 'react-router'

import { Container } from '@/components/layout/container'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <Container className="py-24 text-center">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="mt-2 font-heading text-3xl font-semibold">
        Page not found
      </h1>
      <p className="mt-2 text-muted-foreground">
        That page doesn’t exist (or hasn’t been built yet).
      </p>
      <Button asChild className="mt-6">
        <Link to="/">Back home</Link>
      </Button>
    </Container>
  )
}
