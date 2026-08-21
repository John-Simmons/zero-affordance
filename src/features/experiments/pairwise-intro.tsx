import { Mark } from '@/components/layout/mark'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Experiment } from '@/lib/data/types'

/**
 * The first screen of a pairwise experiment, standing in for the runner until
 * the participant chooses what to do.
 *
 * An inline card rather than a modal: it still gates the experiment — nothing is
 * playable until a choice is made — but the header, nav and footer stay
 * reachable, so anyone who decides this isn't for them can simply leave.
 *
 * Owns `experiment.description`: the detail route deliberately withholds it for
 * pairwise runs so it appears here once, where it briefs someone about to play
 * rather than sitting under the page title as header furniture. Keep the two in
 * step — rendering it in both places would show the same text twice on one
 * screen, which is why it lived in only one of them to begin with.
 *
 * Still does NOT repeat `hypothesis`; `PairwiseRunner` renders that below
 * this card, and again on the standings, but not during the matchups.
 */
export function PairwiseIntro({
  experiment,
  onStart,
  onSkip,
}: {
  experiment: Experiment
  onStart: () => void
  onSkip: () => void
}) {
  const pairCount =
    (experiment.variants.length * (experiment.variants.length - 1)) / 2

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {/* The favicon inline, at heading size. Decorative (the Mark is
              aria-hidden), so the heading still reads as just its text. */}
          <Mark className="size-5" />
          Before you start
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Full-strength text, unlike the muted steps below it: this is the
            brief, and the numbered list is the procedure. */}
        <p className="text-sm text-pretty">{experiment.description}</p>

        <div className="space-y-2 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-1.5 pl-4">
            <li>Start the matchup.</li>
            <li>
              Two loading states run back to back, each followed by the page it
              was loading.
            </li>
            <li>Say which felt faster, or call it too close.</li>
            <li>
              Repeat for all {pairCount} pairings, then see where everything
              ranks.
            </li>
          </ol>
          {/*
            Says "within a matchup" explicitly now that the base moves between
            matchups. The old wording read as a claim about the whole run, which
            stopped being true — and the varying length is worth stating rather
            than hiding, since a participant who noticed it unexplained would
            reasonably assume something was broken.
          */}
          <p className="pt-1 text-xs">
            Within a matchup both run for about the same length, nudged slightly
            at random. That length changes from matchup to matchup, so there is
            no fixed yardstick to measure against. The ranking corrects for
            whatever difference is left, so simply being quicker is not enough
            to win.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={onStart}>Start the experiment</Button>
          <Button variant="outline" onClick={onSkip}>
            Skip to results
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
