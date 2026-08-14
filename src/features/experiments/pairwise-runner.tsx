import { ArrowRight, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { AccuracyScore } from '@/features/experiments/accuracy-score'
import { EloResults } from '@/features/experiments/elo-results'
import { IndicatorPreview } from '@/features/experiments/indicator-preview'
import { loadingIndicators } from '@/features/experiments/indicators'
import { LoadedContent } from '@/features/experiments/loaded-content'
import { useTimedProgress } from '@/features/experiments/use-timed-progress'
import { PairwiseIntro } from '@/features/experiments/pairwise-intro'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  computeElo,
  rollMatchupDurations,
  roundRobinPairs,
  START_RATING,
} from '@/lib/data/aggregate'
import { useEloAggregate, useRecordMatch } from '@/lib/data/hooks'
import { cn } from '@/lib/utils'
import type {
  EloAggregate,
  Experiment,
  ExperimentVariant,
  MatchInput,
  MatchOutcome,
} from '@/lib/data/types'
import { getVisitorId } from '@/lib/visitor'

/** One head-to-head, with playback order and durations already decided. */
interface Matchup {
  /** Played first. */
  a: ExperimentVariant
  /** Played second. */
  b: ExperimentVariant
  durationAMs: number
  durationBMs: number
  /**
   * Identifies this appearance to whichever indicator plays it, so one that
   * varies its content (the quote) can pick something new each matchup and
   * still show the SAME thing in the vote-time recap. Belongs to the matchup
   * rather than to a side, exactly like the duration base.
   */
  seed: number
}

/**
 * One matchup, played as a sequence:
 *
 *   idle → first → first-held → second → second-held → voting
 *
 * The `*-held` stages keep the loaded article on screen briefly. The arrival of
 * content is what ends a perceived wait, so it has to actually be seen —
 * cutting straight to the next indicator would erase the moment being judged.
 */
type Stage =
  'idle' | 'first' | 'first-held' | 'second' | 'second-held' | 'voting'

/** How long the loaded article stays up. Identical for both, so neither gains. */
const HOLD_MS = 1000

/**
 * Total height of the matchup area: badge row, stimulus frame, and the vote
 * block once it appears.
 *
 * Fixed, so the card is exactly as tall while an animation plays as it is while
 * you vote — the page never jumps. The frame inside simply flexes, reclaiming
 * the vote block's space during playback, which is when it is wanted.
 */
const MATCHUP_AREA = 'h-112'

/**
 * The area a loading state gets to occupy.
 *
 * Fills its slot rather than declaring a height, so the frame is whatever the
 * matchup area has spare. A skeleton loader's effect on perceived wait depends
 * on how much of the viewport it stands in for, so bigger is better here.
 *
 * A single shared constant because the size must be IDENTICAL for both variants
 * in a matchup. If one loading state got a larger canvas than another, footprint
 * would silently become a second independent variable and the ratings would no
 * longer isolate the animation itself. `h-full` also stops the frame resizing as
 * the indicator gives way to the article.
 */
const STIMULUS_CANVAS =
  'h-full w-full overflow-hidden rounded-lg border bg-muted/40 p-6'

function shuffle<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Every pairing exactly once, in a random order, with playback order randomised
 * and durations rolled per matchup.
 *
 * `a` is always played FIRST and `b` second, so the coin flip below is what
 * controls for primacy/recency: the second indicator is fresher in memory when
 * the vote is cast, and without randomising which variant lands there, that
 * advantage would fall on the same ones every run.
 *
 * Built once per run (via lazy `useState`) rather than in a `useMemo`, because
 * it is deliberately impure — a memo is free to recompute and would silently
 * re-roll the durations mid-run.
 */
function buildRunPlan(variants: ExperimentVariant[]): Matchup[] {
  const pairs = shuffle(roundRobinPairs(variants))
  /*
    A permutation, not independent draws, and shuffled rather than positional.

    Distinct matters: an indicator keying content off the seed gets something
    different every appearance. Drawing independently from a pool of fifteen
    would leave all five quote appearances distinct only about 47% of the time
    — a repeat in most runs, which is the whole thing being fixed.

    Shuffled matters separately: with `seed = i` the seed would just be the
    playback position, so the very first thing a participant sees — the one
    they are most likely to read attentively — would always come from the head
    of the pool.
  */
  const seeds = shuffle(pairs.map((_, i) => i))

  return pairs.map(([x, y], i) => {
    const [a, b] = Math.random() < 0.5 ? [x, y] : [y, x]
    // Durations belong to the matchup, not to either variant: both sides share
    // one base so length never competes with the animation being judged, and
    // the base moves between matchups so it cannot be learned. Shared with the
    // mock provider's baseline so both are rated on the same scale.
    return { a, b, seed: seeds[i], ...rollMatchupDurations(Math.random) }
  })
}

/**
 * The full-width stage. Presentational — the runner owns the sequence; this
 * just renders whichever indicator is currently running, or the article that
 * arrived when it finished.
 */
function StimulusCanvas({
  variant,
  durationMs,
  loaded,
  onDone,
  seed,
}: {
  variant: ExperimentVariant
  durationMs: number
  loaded: boolean
  onDone: () => void
  seed: number
}) {
  const progress = useTimedProgress(durationMs, !loaded, onDone)
  const Indicator = loadingIndicators[variant.id]

  return (
    <div className={STIMULUS_CANVAS}>
      {loaded ? (
        // Top-aligned, the way a real page fills its frame — unlike the
        // indicator, which is centred in the space the content will take.
        <LoadedContent />
      ) : (
        <div className="flex h-full items-center justify-center">
          {Indicator && <Indicator progress={progress} seed={seed} />}
        </div>
      )}
    </div>
  )
}

/**
 * A reminder of which indicator played when, shown while voting.
 *
 * Renders the indicator itself at its end state, not the article it loaded —
 * the article is identical for every variant by design, so two copies of it
 * would be indistinguishable and anchor nothing.
 *
 * The name is shown alongside because `blank` has, correctly, nothing to draw;
 * without it that panel would read as broken rather than as the control.
 *
 * `seed` is what makes "which indicator played" literally true for a variant
 * whose content varies: this is a fresh mount, so without the matchup's seed
 * the quote here would be a different one from the quote just watched.
 */
function RecapPanel({
  variant,
  position,
  seed,
}: {
  variant: ExperimentVariant
  position: string
  seed: number
}) {
  const Indicator = loadingIndicators[variant.id]

  return (
    // h-full so the pair fills the same box the canvas occupied.
    //
    // Tighter chrome below sm. The two panels stack there and split one fixed
    // frame between them (see grid-rows at the call site), so each gets ~114px
    // total — and at desktop padding the border, gap and stacked label ate 75%
    // of that, leaving 28px for the indicator itself. A skeleton rendered as a
    // single bar. Every pixel taken back here goes straight to the thing the
    // panel exists to show.
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border bg-muted/40 p-2 sm:gap-4 sm:p-4">
      {/*
        w-full because the panel is `items-center`, which leaves this box
        shrink-to-fit. Percentage-width children contribute nothing to intrinsic
        width, so a full-bleed indicator like the skeleton collapsed to the
        width of its one fixed-width bar (w-24) and rendered as a 96px sliver.

        min-h-0 + overflow-hidden is what keeps a full-frame indicator inside
        the panel — but it only bites because the grid pins the row height; see
        grid-rows there.
      */}
      <div className="flex min-h-0 w-full flex-1 items-start justify-center overflow-hidden sm:items-center">
        {Indicator && <Indicator progress={1} seed={seed} />}
      </div>
      {/*
        One line below sm ("First · Classic spinner"), two from sm up. Stacking
        these costs a whole row of the panel's scarce height on a phone, and the
        position and the name read perfectly well as a single line.

        shrink-0 so this never gives up height to the indicator box above it —
        the name is what stops the `blank` control reading as a broken panel.
      */}
      <div className="flex shrink-0 flex-wrap items-baseline justify-center gap-x-1.5 text-center sm:block">
        <p className="text-xs font-medium text-muted-foreground">{position}</p>
        <span aria-hidden className="text-xs text-muted-foreground sm:hidden">
          ·
        </span>
        <p className="text-sm text-foreground">{variant.label}</p>
      </div>
    </div>
  )
}

/** `{ variantId: rating }`, the shape `computeElo` seeds from. */
function ratingsById(aggregate: EloAggregate): Record<string, number> {
  return Object.fromEntries(
    aggregate.ratings.map((r) => [r.variantId, r.rating]),
  )
}

export function PairwiseRunner({ experiment }: { experiment: Experiment }) {
  const visitorId = getVisitorId()
  const recordMatch = useRecordMatch()

  const [plan, setPlan] = useState(() => buildRunPlan(experiment.variants))
  const [round, setRound] = useState(0)
  const [stage, setStage] = useState<Stage>('idle')
  // `intro` gates the whole thing behind an explanation; `results` is reached
  // either by finishing a run or by skipping straight there.
  const [phase, setPhase] = useState<'intro' | 'playing' | 'results'>('intro')
  const [myMatches, setMyMatches] = useState<MatchInput[]>([])

  // Enabled from mount, not just at the end, so we can capture the standings as
  // they were BEFORE this run. Nothing renders it until `phase` is 'results',
  // which is reached either by playing or by explicitly skipping.
  const aggregate = useEloAggregate(experiment.id)

  // Frozen on first arrival. Each vote invalidates the elo query, so this
  // refetches ten times during a run — without freezing, the baseline would
  // creep along with the participant's own votes and every delta would collapse
  // toward zero.
  const [snapshot, setSnapshot] = useState<Record<string, number>>()
  useEffect(() => {
    if (snapshot === undefined && aggregate.data) {
      setSnapshot(ratingsById(aggregate.data))
    }
  }, [aggregate.data, snapshot])

  // The article holds on screen, then the sequence moves on by itself.
  useEffect(() => {
    if (stage !== 'first-held' && stage !== 'second-held') return
    const id = setTimeout(
      () => setStage(stage === 'first-held' ? 'second' : 'voting'),
      HOLD_MS,
    )
    return () => clearTimeout(id)
  }, [stage])

  const matchup = plan[round]

  /**
   * Start a fresh run from the standings screen.
   *
   * Re-freezes the snapshot at the CURRENT standings, not the ones captured on
   * mount. Without that, a second run's deltas would be measured against the
   * baseline from before the first run and would double-count it.
   */
  const restart = () => {
    setPlan(buildRunPlan(experiment.variants))
    setRound(0)
    setStage('idle')
    setMyMatches([])
    setSnapshot(aggregate.data ? ratingsById(aggregate.data) : undefined)
    setPhase('playing')
  }

  const vote = (outcome: MatchOutcome) => {
    // Belt and braces: the buttons only render at 'voting', but a stray call
    // here would record a match for a matchup nobody watched.
    if (stage !== 'voting' || recordMatch.isPending) return
    const input: MatchInput = {
      experimentId: experiment.id,
      visitorId,
      variantAId: matchup.a.id,
      variantBId: matchup.b.id,
      durationAMs: matchup.durationAMs,
      durationBMs: matchup.durationBMs,
      outcome,
    }
    recordMatch.mutate(input, {
      onSuccess: () => {
        // Only matches that actually persisted count toward the delta.
        setMyMatches((prev) => [...prev, input])
        if (round + 1 >= plan.length) {
          setPhase('results')
          // Derived, not written out: the count is C(variants, 2), so it went
          // from ten to fifteen the moment a sixth indicator was added.
          toast.success(
            `All ${plan.length} matchups done — here are the standings.`,
          )
          return
        }
        setRound((r) => r + 1)
        setStage('idle')
      },
      // Buttons stay enabled so the vote can simply be retried.
      onError: () => toast.error('Could not record that vote. Try again.'),
    })
  }

  if (phase === 'results') {
    // Replaying only this participant's matches, seeded with the standings as
    // they were before they played, isolates exactly what their votes did —
    // unaffected by anyone else voting during the run. Without a snapshot
    // (e.g. the initial fetch failed) we show no deltas rather than wrong ones.
    //
    // Someone who skipped has no matches, so they get no deltas at all — a
    // column of "(±0)" would imply they had voted and changed nothing.
    const deltas =
      snapshot && myMatches.length > 0
        ? Object.fromEntries(
            computeElo(experiment, myMatches, snapshot).ratings.map((r) => [
              r.variantId,
              r.rating - (snapshot[r.variantId] ?? START_RATING),
            ]),
          )
        : undefined

    return (
      // Own spacing rather than borrowing the route wrapper's, so the two cards
      // sit correctly wherever this is mounted.
      <div className="space-y-6">
        <Button variant="outline" onClick={restart}>
          {myMatches.length === 0 ? (
            <>
              Take the experiment <ArrowRight />
            </>
          ) : (
            <>
              Take it again <RotateCcw />
            </>
          )}
        </Button>

        {/*
          Same gate as the deltas above: someone who skipped straight here has
          nothing to score, and an empty scoreboard would imply they played and
          got everything wrong. It needs no `aggregate`, so it renders straight
          away rather than behind the standings' loading skeleton.
        */}
        {myMatches.length > 0 && <AccuracyScore matches={myMatches} />}

        <Card>
          <CardHeader>
            <CardTitle>Standings</CardTitle>
          </CardHeader>
          <CardContent>
            <EloResults
              aggregate={aggregate.data}
              isLoading={aggregate.isLoading}
              deltas={deltas}
              voteCount={myMatches.length}
              // The standings render from an aggregate, which carries no copy
              // and no durations, so the preview has to be built out here where
              // the seeded variants are. Falling back to the plain name mirrors
              // the `{Indicator && …}` guard above: a variant that somehow has
              // no match still gets a readable row.
              renderLabel={(r) => {
                const variant = experiment.variants.find(
                  (v) => v.id === r.variantId,
                )
                return variant ? (
                  <IndicatorPreview variant={variant} />
                ) : (
                  r.label
                )
              }}
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (phase === 'intro') {
    return (
      <PairwiseIntro
        experiment={experiment}
        onStart={() => setPhase('playing')}
        onSkip={() => setPhase('results')}
      />
    )
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between">
          <CardTitle>Which felt faster?</CardTitle>
          <Badge variant="secondary">
            Matchup {round + 1} of {plan.length}
          </Badge>
        </div>
        <Progress value={(round / plan.length) * 100} />
      </CardHeader>

      {/*
        Fixed total height, with the stimulus area flexing to fill whatever the
        vote block isn't using. So the card never changes height — no screen jump
        — while the frame gets the vote block's space back during playback, which
        is when the animation actually needs it.

        Deliberately not "canvas height + vote block height" arithmetic: two
        numbers that must sum correctly drift the moment either changes, and
        that drift is what made the page jump before.
      */}
      <CardContent className={cn('flex flex-col gap-6', MATCHUP_AREA)}>
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex h-6 shrink-0 items-center justify-center">
            {stage !== 'idle' && stage !== 'voting' && (
              <Badge variant="secondary">
                {stage.startsWith('first') ? 'First of two' : 'Second of two'}
              </Badge>
            )}
          </div>

          {/* The frame. Identical for both variants in a matchup, which is what
              keeps footprint from becoming a second independent variable. */}
          <div className="min-h-0 flex-1">
            {stage === 'idle' && (
              // The trigger sits where the loading state is about to appear, so
              // the eye is already on the right spot when playback starts.
              <div className={STIMULUS_CANVAS}>
                <div className="flex h-full items-center justify-center">
                  <Button type="button" onClick={() => setStage('first')}>
                    Start matchup {round + 1}
                  </Button>
                </div>
              </div>
            )}

            {(stage === 'first' || stage === 'first-held') && (
              <StimulusCanvas
                key={`${round}-a`}
                variant={matchup.a}
                seed={matchup.seed}
                durationMs={matchup.durationAMs}
                loaded={stage === 'first-held'}
                onDone={() => setStage('first-held')}
              />
            )}

            {(stage === 'second' || stage === 'second-held') && (
              <StimulusCanvas
                key={`${round}-b`}
                variant={matchup.b}
                seed={matchup.seed}
                durationMs={matchup.durationBMs}
                loaded={stage === 'second-held'}
                onDone={() => setStage('second-held')}
              />
            )}

            {stage === 'voting' && (
              // Explicit rows, because implicit ones are `auto`: they size to
              // the tallest panel and happily overflow the frame. A full-frame
              // indicator (the skeleton) then pushed the panels past the vote
              // buttons and out of the card, and no amount of overflow-hidden
              // below could help — nothing had a bounded height to clip
              // against. minmax(0, 1fr), which is what grid-rows-N expands to,
              // pins each row to its share of the frame instead.
              <div className="grid h-full grid-rows-2 gap-4 sm:grid-cols-2 sm:grid-rows-1">
                <RecapPanel
                  variant={matchup.a}
                  position="First"
                  seed={matchup.seed}
                />
                <RecapPanel
                  variant={matchup.b}
                  position="Second"
                  seed={matchup.seed}
                />
              </div>
            )}
          </div>
        </div>

        {/*
          Only once both have run. Previously these sat here disabled for the
          whole matchup, which read as broken rather than as not-yet-your-turn,
          and put three dead controls next to the thing being watched.

          Appearing here costs the frame some height rather than growing the
          card: MATCHUP_AREA fixes the total, so the stimulus simply hands back
          the space it borrowed during playback and nothing on the page moves.
        */}
        {stage === 'voting' && (
          <div className="space-y-3">
            <p className="text-sm font-medium">{experiment.metricLabel}</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Button
                type="button"
                variant="outline"
                disabled={recordMatch.isPending}
                onClick={() => vote('a')}
              >
                First felt faster
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={recordMatch.isPending}
                onClick={() => vote('tie')}
              >
                Too close to call
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={recordMatch.isPending}
                onClick={() => vote('b')}
              >
                Second felt faster
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
