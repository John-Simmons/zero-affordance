import { ChevronUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { VideoIdea } from '@/lib/data/types'

/**
 * The board of submitted ideas.
 *
 * Presentational on purpose — it takes the list and a callback and owns no data
 * fetching, so it can be rendered from a fixture in a test the way `EloResults`
 * is.
 */
export function IdeaList({
  ideas,
  isLoading,
  onSetVote,
  pendingIdeaId,
}: {
  ideas: VideoIdea[] | undefined
  isLoading: boolean
  /**
   * Reports the state the visitor asked for, not "flip it" — the caller must
   * not have to guess how many times this fired.
   */
  onSetVote: (ideaId: string, voted: boolean) => void
  /** The one idea with a vote in flight, if any. Only its button locks. */
  pendingIdeaId?: string | null
}) {
  if (isLoading || !ideas) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (ideas.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No ideas yet — yours would be the first.
        </CardContent>
      </Card>
    )
  }

  return (
    <ul className="space-y-3">
      {ideas.map((idea) => (
        <li key={idea.id}>
          <Card>
            <CardContent className="flex items-start gap-4">
              {/*
                The button is a chevron and a number, so it has no usable text
                of its own — the label is what names it, and aria-pressed is
                what conveys that voting is a toggle rather than a one-way tap.
              */}
              <Button
                type="button"
                variant="outline"
                onClick={() => onSetVote(idea.id, !idea.votedByVisitor)}
                // Locked only while this idea's own vote is in flight: it stops
                // a second tap from racing the first, without freezing the rest
                // of the board over one slow request.
                disabled={pendingIdeaId === idea.id}
                aria-pressed={idea.votedByVisitor}
                aria-label={`Upvote “${idea.title}”`}
                className={cn(
                  'h-auto shrink-0 flex-col gap-0.5 px-3 py-2',
                  idea.votedByVisitor &&
                    'border-foreground/30 bg-muted text-foreground',
                )}
              >
                <ChevronUp aria-hidden />
                <span className="text-xs tabular-nums">{idea.voteCount}</span>
              </Button>

              <div className="min-w-0 space-y-1">
                {/* break-words so one long unbroken string cannot widen the
                    card past the viewport on a phone. */}
                <h3 className="font-medium break-words">{idea.title}</h3>
                <p className="text-sm text-pretty break-words text-muted-foreground">
                  {idea.description}
                </p>
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  )
}
