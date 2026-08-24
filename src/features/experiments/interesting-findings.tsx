import type { ReactNode } from 'react'

import { Mark } from '@/components/layout/mark'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { IndicatorPreview } from '@/features/experiments/indicator-preview'
import { MIN_FINDING_SAMPLE } from '@/lib/data/aggregate'
import type {
  ExperimentVariant,
  MatchInsights,
  PairRecord,
} from '@/lib/data/types'

/**
 * The control condition, named here rather than in the aggregate.
 *
 * `computeMatchInsights` returns a record for every pairing and takes no view
 * on which of them is interesting; knowing that `blank` is the one that draws
 * nothing is knowledge about THIS experiment, and this file is already
 * experiment-specific. The alternative — a `control` flag on the variant —
 * would mean a migration plus both seed mirrors to express something the
 * indicator registry next door already hardcodes by id.
 *
 * A pairing that does not exist simply drops the finding, so an experiment
 * without this variant degrades to five findings rather than throwing.
 */
const CONTROL_VARIANT_ID = 'blank'

/** Whole percent. The findings are about direction, not about decimals. */
function percent(part: number, whole: number): string {
  return whole === 0 ? '—' : `${Math.round((part / whole) * 100)}%`
}

/** "0.4s" — the same tenths-of-a-second scale the matchup cards use. */
function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}

/**
 * A variant, named the way the standings name it.
 *
 * No series swatch, unlike the standings table and the chart. Those two are one
 * dataset shown twice and the colour is the key across them; a name inside a
 * sentence has nothing to be keyed to, and a coloured chip mid-clause reads as
 * punctuation. The name still carries its preview, which is the part that is
 * worth having everywhere.
 */
function VariantName({
  variantId,
  label,
  variants,
}: {
  variantId: string
  label: string
  variants: ExperimentVariant[]
}) {
  const variant = variants.find((v) => v.id === variantId)

  return (
    <span className="font-medium text-foreground">
      {variant ? <IndicatorPreview variant={variant} /> : label}
    </span>
  )
}

/**
 * One question and its answer.
 *
 * A `<dl>` entry rather than a heading and a paragraph: the question genuinely
 * is the term and the answer genuinely is its definition, and the pairing is
 * what a screen reader gets for free from the markup.
 *
 * `sample` is never hidden and never gates the answer. A finding resting on
 * nine matchups still says what it says — the count is right there for anyone
 * who wants to weigh it, and below {@link MIN_FINDING_SAMPLE} it says so in as
 * many words. Hiding thin findings would make the section quietly change shape
 * as the corpus grew, which is a worse kind of dishonest than a small number.
 */
function Finding({
  question,
  sample,
  children,
}: {
  question: string
  /** `one` is used in place of `noun` at a count of exactly one. */
  sample: { count: number; noun: string; one?: string }
  children: ReactNode
}) {
  return (
    <div className="space-y-1">
      <dt className="text-sm font-medium text-pretty">{question}</dt>
      <dd className="space-y-1 text-sm text-muted-foreground">
        {children}
        <p className="text-xs">
          From {sample.count}{' '}
          {sample.count === 1 ? (sample.one ?? sample.noun) : sample.noun}
          {sample.count < MIN_FINDING_SAMPLE && ' — still early'}.
        </p>
      </dd>
    </div>
  )
}

/** The blank control's record against one loading state, from its opponent's side. */
function versusControl(pair: PairRecord): {
  variantId: string
  wins: number
  losses: number
  ties: number
} {
  const controlIsA = pair.aId === CONTROL_VARIANT_ID
  return {
    variantId: controlIsA ? pair.bId : pair.aId,
    wins: controlIsA ? pair.bWins : pair.aWins,
    losses: controlIsA ? pair.aWins : pair.bWins,
    ties: pair.ties,
  }
}

/**
 * What the whole match log says, beyond who is winning.
 *
 * Global on purpose, and the one section here that is: the standings above are
 * global and the perception score is personal, so this sits with the former.
 * Nothing in it is gated on having played — someone who skipped straight to the
 * results still gets every finding, because none of them is about them.
 *
 * Renders from a `MatchInsights` and the seeded variants, the same split
 * `EloResults` uses: the aggregate carries ids and labels, and only the caller
 * holds the descriptions a preview needs.
 */
export function InterestingFindings({
  insights,
  isLoading,
  variants,
}: {
  insights: MatchInsights | undefined
  isLoading: boolean
  variants: ExperimentVariant[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mark className="size-5" />
          Other findings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <FindingsBody
          insights={insights}
          isLoading={isLoading}
          variants={variants}
        />
      </CardContent>
    </Card>
  )
}

function FindingsBody({
  insights,
  isLoading,
  variants,
}: {
  insights: MatchInsights | undefined
  isLoading: boolean
  variants: ExperimentVariant[]
}) {
  if (isLoading || !insights) return <Skeleton className="h-64 w-full" />

  if (insights.totalMatches === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nobody has played this one yet, so there is nothing to compare. Take the
        experiment and these questions get their first answers.
      </p>
    )
  }

  const { positionSplit, gapAccuracy, totalMatches } = insights
  const decisive = positionSplit.first + positionSplit.second

  // Only a variant that has actually won while slower can answer this; one
  // that never has reports a mean of zero, which would otherwise sort as an
  // answer rather than as an absence.
  const handicap = insights.handicaps.find((h) => h.wins > 0)

  const control = insights.pairRecords
    .filter((p) => p.aId === CONTROL_VARIANT_ID || p.bId === CONTROL_VARIANT_ID)
    .map(versusControl)
  // Named from the challenger's side, matching `versusControl`: these are the
  // matchups the blank screen LOST, which is what the sentence asks about.
  const winsVsControl = control.reduce((n, r) => n + r.wins, 0)
  const decidedVsControl = control.reduce((n, r) => n + r.wins + r.losses, 0)
  // Ranked on the record itself rather than on rate, so one lucky win out of
  // one does not outrank nine out of twelve.
  const bestVsControl = [...control]
    .filter((r) => r.wins + r.losses > 0)
    .sort((x, y) => y.wins - y.losses - (x.wins - x.losses))

  const labelOf = (variantId: string) =>
    variants.find((v) => v.id === variantId)?.label ?? variantId

  const { replayAccuracy, contradictions, accuracySpread } = insights
  const replayScored =
    replayAccuracy.replayed.scored + replayAccuracy.firstView.scored
  // Only a variant that has actually been in a replayed matchup can answer
  // this; the list is sorted by rate, so a corpus with no redos at all would
  // otherwise put whichever name sorts first at the top of an empty finding.
  const mostReplayed = insights.redos.find((r) => r.replayed > 0)
  const spreadPeak = Math.max(
    1,
    ...accuracySpread.buckets.map((b) => b.visitors),
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-pretty text-muted-foreground">
        This data takes into account all {totalMatches} matchups that have been
        played, not just your run.
      </p>

      <dl className="space-y-6">
        {accuracySpread.visitors > 0 && (
          <Finding
            question="How much do individual scores vary between people?"
            sample={{
              count: accuracySpread.visitors,
              noun: 'scored runs',
              one: 'scored run',
            }}
          >
            <p>
              The middle score is{' '}
              <strong className="font-semibold text-foreground tabular-nums">
                {Math.round(accuracySpread.medianPercent)}%
              </strong>
              . What matters is the shape rather than the average: one hump near
              half means everybody is guessing, two means some people genuinely
              read duration and the rest do not.
            </p>
            <ul className="space-y-1">
              {accuracySpread.buckets.map((bucket) => (
                <li
                  key={bucket.minPercent}
                  className="flex items-center gap-3 tabular-nums"
                >
                  <span className="w-16 shrink-0 text-xs">
                    {bucket.minPercent}–{bucket.maxPercent}%
                  </span>
                  {/*
                    Scaled against the fullest band rather than against the
                    number of people, so a distribution where everyone lands in
                    the middle still draws a shape instead of one visible bar
                    and four slivers. aria-hidden: the count beside it is the
                    same fact in words.
                  */}
                  <span
                    aria-hidden
                    className="h-2 min-w-px rounded-full bg-foreground/40"
                    style={{
                      width: `${(bucket.visitors / spreadPeak) * 100}%`,
                    }}
                  />
                  <span className="text-xs">{bucket.visitors}</span>
                </li>
              ))}
            </ul>
          </Finding>
        )}

        {mostReplayed && (
          <Finding
            question="Which loading animation makes people ask for a replay most often?"
            sample={{
              count: mostReplayed.matches,
              noun: 'matchups it played',
              one: 'matchup it played',
            }}
          >
            <p>
              <VariantName
                variantId={mostReplayed.variantId}
                label={mostReplayed.label}
                variants={variants}
              />{' '}
              was in a replayed matchup{' '}
              <strong className="font-semibold text-foreground tabular-nums">
                {percent(mostReplayed.replayed, mostReplayed.matches)}
              </strong>{' '}
              of the time it appeared ({mostReplayed.replayed} of{' '}
              {mostReplayed.matches}). A replay covers both animations at once,
              so this says the pairings it turns up in were hard to separate
              rather than that this one was the forgettable half.
            </p>
          </Finding>
        )}

        <Finding
          question="Do people favor the animation they saw first or second in matchups?"
          sample={{
            count: decisive,
            noun: 'decided matchups',
            one: 'decided matchup',
          }}
        >
          <p>
            <strong className="font-semibold text-foreground tabular-nums">
              {percent(positionSplit.second, decisive)}
            </strong>{' '}
            of votes went to whichever animation played second. The runner
            randomises which loading state lands in each slot, so anything off
            50/50 here is the slot talking, not the animation.
          </p>
          {/*
            aria-hidden: it is the two numbers in the sentence above, drawn. A
            bar announced as a bar would make a reader hear the same split
            twice, the second time without its units.
          */}
          <div
            aria-hidden
            className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full bg-foreground/60"
              style={{
                width: `${decisive === 0 ? 50 : (positionSplit.first / decisive) * 100}%`,
              }}
            />
            <div className="h-full flex-1 bg-foreground/25" />
          </div>
          <p className="flex justify-between text-xs tabular-nums">
            <span>First {percent(positionSplit.first, decisive)}</span>
            <span>{percent(positionSplit.second, decisive)} Second</span>
          </p>
        </Finding>

        {handicap && (
          <Finding
            question="Which loading animation overcame the largest gap on average when voted as faster while actually being slower?"
            sample={{
              count: handicap.wins,
              noun: 'wins while running longer',
              one: 'win while running longer',
            }}
          >
            <p>
              <VariantName
                variantId={handicap.variantId}
                label={handicap.label}
                variants={variants}
              />{' '}
              was able to, on average, overcome a{' '}
              <strong className="font-semibold text-foreground tabular-nums">
                {seconds(handicap.meanGapMs)}
              </strong>{' '}
              duration gap when voted as being faster than its opponent
              animation while actually being slower.
            </p>
          </Finding>
        )}

        <Finding
          question="How big does the loading animation gap have to be before people notice it?"
          sample={{
            count: gapAccuracy.reduce((n, b) => n + b.scored, 0),
            noun: 'decided matchups',
          }}
        >
          <p>
            How often the shorter animation was picked as faster, grouped by how
            far apart the two animations really were.
          </p>
          <ul className="space-y-1">
            {gapAccuracy.map((bucket, i) => {
              const lower = i === 0 ? null : gapAccuracy[i - 1].maxRelativeGap
              const range =
                bucket.maxRelativeGap === null
                  ? `over ${percent(lower ?? 0, 1)}`
                  : lower === null
                    ? `under ${percent(bucket.maxRelativeGap, 1)}`
                    : `${percent(lower, 1)}–${percent(bucket.maxRelativeGap, 1)}`
              return (
                <li
                  key={range}
                  className="flex items-baseline justify-between gap-3 tabular-nums"
                >
                  <span>{range} apart</span>
                  <span>
                    <strong className="font-semibold text-foreground">
                      {percent(bucket.correct, bucket.scored)}
                    </strong>{' '}
                    <span className="text-xs">
                      picked the shorter one ({bucket.scored})
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </Finding>

        {decidedVsControl > 0 && (
          <Finding
            question="Is showing something better than showing nothing at all?"
            sample={{
              count: decidedVsControl,
              noun: 'matchups against the blank screen',
              one: 'matchup against the blank screen',
            }}
          >
            <p>
              Loading states beat the blank screen in{' '}
              <strong className="font-semibold text-foreground tabular-nums">
                {percent(winsVsControl, decidedVsControl)}
              </strong>{' '}
              of the matchups they played against it ({winsVsControl} of{' '}
              {decidedVsControl}).
              {bestVsControl.length > 0 && (
                <>
                  {' '}
                  Best against it:{' '}
                  <VariantName
                    variantId={bestVsControl[0].variantId}
                    label={labelOf(bestVsControl[0].variantId)}
                    variants={variants}
                  />{' '}
                  ({bestVsControl[0].wins}–{bestVsControl[0].losses}). Worst:{' '}
                  <VariantName
                    variantId={
                      bestVsControl[bestVsControl.length - 1].variantId
                    }
                    label={labelOf(
                      bestVsControl[bestVsControl.length - 1].variantId,
                    )}
                    variants={variants}
                  />{' '}
                  ({bestVsControl[bestVsControl.length - 1].wins}–
                  {bestVsControl[bestVsControl.length - 1].losses}).
                </>
              )}
            </p>
          </Finding>
        )}

        {replayAccuracy.replayed.scored > 0 && (
          <Finding
            question="Are matchups judged more accurately when people replay them?"
            sample={{
              count: replayScored,
              noun: 'marked matchups',
              one: 'marked matchup',
            }}
          >
            <p>
              Replayed matchups were called correctly{' '}
              <strong className="font-semibold text-foreground tabular-nums">
                {percent(
                  replayAccuracy.replayed.correct,
                  replayAccuracy.replayed.scored,
                )}
              </strong>{' '}
              of the time ({replayAccuracy.replayed.scored} of them), against{' '}
              <strong className="font-semibold text-foreground tabular-nums">
                {percent(
                  replayAccuracy.firstView.correct,
                  replayAccuracy.firstView.scored,
                )}
              </strong>{' '}
              on a single viewing ({replayAccuracy.firstView.scored}). Watching
              twice is a choice people make when a matchup felt close, so the
              two groups are not the same matchups judged twice — a lower number
              here is the difficulty talking, not the replay.
            </p>
          </Finding>
        )}

        {contradictions.triples > 0 && (
          <Finding
            question="How often do people contradict themselves?"
            sample={{
              count: contradictions.visitorsScored,
              noun: 'people with a complete set of three',
              one: 'person with a complete set of three',
            }}
          >
            <p>
              <strong className="font-semibold text-foreground tabular-nums">
                {percent(
                  contradictions.visitorsWithCycle,
                  contradictions.visitorsScored,
                )}
              </strong>{' '}
              of people voted in a circle at least once — i.e. animation A felt
              faster than animation B, animation B felt faster than animation C,
              and animation C faster than animation A. No ranking can satisfy
              all three, so at least one of those votes was a contradiction.
              Across every complete set of three,{' '}
              {percent(contradictions.cyclic, contradictions.triples)} came out
              circular ({contradictions.cyclic} of {contradictions.triples}).
            </p>
          </Finding>
        )}
      </dl>
    </div>
  )
}
