import { Info } from 'lucide-react'

import { Mark } from '@/components/layout/mark'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { MatchupStrip } from '@/features/experiments/matchup-strip'
import { scoreAccuracy } from '@/lib/data/aggregate'
import type { ExperimentVariant, MatchInput } from '@/lib/data/types'

/**
 * How well this participant's votes tracked the durations that actually ran.
 *
 * Rendered only for someone who played — the caller gates on having matches, so
 * a visitor who skipped straight to the standings never sees a score, the same
 * way they see no per-variant deltas.
 *
 * Deliberately uncoloured. There is no pass mark here: the number is evidence
 * about perception, not a grade, and a green/red treatment would contradict the
 * framing line below it.
 */
export function AccuracyScore({
  matches,
  variants,
}: {
  matches: MatchInput[]
  variants: ExperimentVariant[]
}) {
  const { correct, scored, ties } = scoreAccuracy(matches)
  const excluded = matches.length - scored

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mark className="size-5" />
          Your perception score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {scored === 0 ? (
          // Every matchup was called too close, so there is nothing to divide
          // by. Saying so beats rendering "0 / 0", which reads as a zero score
          // rather than as an absent one.
          <p className="text-sm text-muted-foreground">
            You called every matchup too close to call, so there is no score to
            show this time. That is a finding in itself — these animations are
            genuinely hard to separate.
          </p>
        ) : (
          <>
            {/*
              Label sits beside the number rather than under it — it reads as
              the number's unit, and it costs a row less vertical space.
              items-center so the small copy sits against the middle of the big
              figure rather than on its baseline, which is where the tooltip
              icon already sits; the three read as one row instead of two
              alignments. It wraps underneath on narrow screens.
            */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {/*
                Number and its footnote are one flex item, so the icon stays
                attached to the score instead of drifting into the gap between
                the score and the words after it.
              */}
              <div className="flex items-center gap-1.5">
                <p className="text-3xl font-semibold tabular-nums">
                  {correct}{' '}
                  <span className="text-muted-foreground">/ {scored}</span>
                </p>
                {/*
                  The denominator is the thing that needs explaining, so the
                  explanation hangs off it rather than sitting at the foot of
                  the card: someone reading "8 / 13" after playing 15 wants the
                  missing two accounted for right there, and a footnote three
                  rows down is answering a question they have already stopped
                  asking.

                  Keyed off everything left out, not just the tie votes, so the
                  denominator is never silently smaller than the matchups
                  played. Ties are the everyday reason; a duration collision
                  (both animations rolling the same millisecond count, so there
                  is no shorter one to have picked) is rare but would otherwise
                  go unexplained.
                */}
                {excluded > 0 && (
                  <ExcludedNote excluded={excluded} ties={ties} />
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                matchups where you picked the loading state that really did run
                faster.
              </p>
            </div>
            <p className="text-sm text-pretty">
              A low score is the finding, not a failure: it is direct evidence
              that how a wait is presented matters more than how long it
              actually lasts.
            </p>
          </>
        )}

        {/*
          Which ones, under how many. Outside the branch above rather than
          inside it: a run called too close throughout has no score to show, and
          a full row of grey is a better account of that than the sentence
          alone.
        */}
        <MatchupStrip matches={matches} variants={variants} />
      </CardContent>
    </Card>
  )
}

/**
 * Why the denominator is smaller than the matchups played.
 *
 * A tooltip rather than a line of copy because this is a footnote about the
 * number rather than part of the finding: it only matters to someone who
 * noticed the mismatch and went looking, and spending a row of the card on it
 * gives it the same weight as the sentence about what a low score means.
 *
 * Touch gets no tooltip — Radix tooltips do not open on tap — which is
 * survivable here and nowhere else on this card: the strip below is the same
 * account in another form, and its grey chips open a drawer that says which
 * matchups these were in as many words.
 */
function ExcludedNote({ excluded, ties }: { excluded: number; ties: number }) {
  return (
    <Tooltip>
      {/*
        A real button, not the icon on its own: this is the only way to reach
        the explanation by keyboard, and an icon with a tabindex would be
        announced as nothing. The label is what a screen reader hears in place
        of the tooltip, so it has to name the number it belongs to — "more
        information" beside a figure it never mentions is not a description of
        anything.
      */}
      <TooltipTrigger
        className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
        aria-label={`Why ${excluded === 1 ? 'one matchup is' : `${excluded} matchups are`} excluded from the score`}
      >
        <Info aria-hidden className="size-4" />
      </TooltipTrigger>
      <TooltipContent>
        {excluded === ties
          ? `${ties === 1 ? 'One matchup' : `${ties} matchups`} you called too close to call ${ties === 1 ? 'is' : 'are'} excluded from the score.`
          : `${excluded} matchups are excluded from the score: those you called too close to call, and any where both loading states happened to run for exactly the same time.`}
      </TooltipContent>
    </Tooltip>
  )
}
