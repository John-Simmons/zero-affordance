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
 * Deliberately does NOT repeat `experiment.description` or `hypothesis`. The
 * detail route already renders those (as the page header and the card below), so
 * echoing them here would show the same text twice on one screen.
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
        <CardTitle>Before you start</CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
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
          <p className="pt-1 text-xs">
            You only get to watch each pair once, so give them your attention.
          </p>
          <p className="pt-1 text-xs">
            Both run for about the same length, nudged slightly at random each
            time. The ranking corrects for whatever difference is left, so
            simply being quicker is not enough to win.
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
