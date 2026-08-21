import { Mark } from '@/components/layout/mark'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { scoreAccuracy } from '@/lib/data/aggregate'
import type { MatchInput } from '@/lib/data/types'

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
export function AccuracyScore({ matches }: { matches: MatchInput[] }) {
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
              items-baseline so the small copy sits on the big figure's
              baseline; it wraps underneath on narrow screens.
            */}
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-3xl font-semibold tabular-nums">
                {correct}{' '}
                <span className="text-muted-foreground">/ {scored}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                matchups where you picked the loading state that really did run
                shorter.
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
          Keyed off everything left out, not just the tie votes, so the
          denominator is never silently smaller than the matchups played. Ties
          are the everyday reason; a duration collision (both animations rolling
          the same millisecond count, so there is no shorter one to have picked)
          is rare but would otherwise go unexplained.

          Suppressed when there is no score at all — the message above already
          says every matchup was called too close, and repeating it as a
          footnote just reads as a stutter.
        */}
        {scored > 0 && excluded > 0 && (
          <p className="text-xs text-muted-foreground">
            {excluded === ties
              ? `${ties === 1 ? 'One matchup' : `${ties} matchups`} you called too close to call ${ties === 1 ? 'is' : 'are'} excluded from the score.`
              : `${excluded} matchups are excluded from the score: those you called too close to call, and any where both loading states happened to run for exactly the same time.`}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
