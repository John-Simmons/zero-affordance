import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Experiment } from '@/lib/data/types'

/**
 * The experiment's hypothesis, as a muted footnote below the runner.
 *
 * Extracted from the detail route because pairwise runs need it in some phases
 * but not others, and only `PairwiseRunner` knows which phase it is in. The
 * route still renders it directly for rating experiments, which have one screen
 * and so nothing to gate it on.
 */
export function HypothesisCard({ experiment }: { experiment: Experiment }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">The hypothesis</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {experiment.hypothesis}
      </CardContent>
    </Card>
  )
}
