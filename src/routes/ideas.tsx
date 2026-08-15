import { useMemo } from 'react'

import { Container } from '@/components/layout/container'
import { IdeaForm } from '@/features/ideas/idea-form'
import { IdeaList } from '@/features/ideas/idea-list'
import { useSetIdeaVote, useVideoIdeas } from '@/lib/data/hooks'
import { getVisitorId } from '@/lib/visitor'

export function IdeasPage() {
  // Read once per mount rather than on every render: it is stable per browser,
  // and it is a query key, so a fresh value each render would thrash the cache.
  const visitorId = useMemo(() => getVisitorId(), [])

  const ideas = useVideoIdeas(visitorId)
  const setVote = useSetIdeaVote(visitorId)

  return (
    <Container className="max-w-2xl py-12">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance">
          Video ideas
        </h1>
        <p className="mt-2 text-pretty text-muted-foreground">
          What should the channel cover next? Post an idea, and vote for the
          ones you want to watch.
        </p>
      </header>

      <div className="mb-6">
        <IdeaForm visitorId={visitorId} />
      </div>

      <IdeaList
        ideas={ideas.data}
        isLoading={ideas.isLoading}
        onSetVote={(ideaId, voted) => setVote.mutate({ ideaId, voted })}
        pendingIdeaId={setVote.isPending ? setVote.variables.ideaId : null}
      />
    </Container>
  )
}
