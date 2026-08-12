import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { EloResults } from '@/features/experiments/elo-results'
import { loadingIndicators } from '@/features/experiments/indicators'
import { LoadedContent } from '@/features/experiments/loaded-content'
import { useTimedProgress } from '@/features/experiments/use-timed-progress'
import { PairwiseIntro } from '@/features/experiments/pairwise-intro'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { computeElo, roundRobinPairs, START_RATING } from '@/lib/data/aggregate'
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

function rollDuration(v: ExperimentVariant): number {
  const base = v.baseDurationMs ?? 1500
  const jitter = v.jitterMs ?? 0
  return Math.round(base + (Math.random() * 2 - 1) * jitter)
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
  return shuffle(roundRobinPairs(variants)).map(([x, y]) => {
    const [a, b] = Math.random() < 0.5 ? [x, y] : [y, x]
    return {
      a,
      b,
      durationAMs: rollDuration(a),
      durationBMs: rollDuration(b),
    }
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
}: {
  variant: ExperimentVariant
  durationMs: number
  loaded: boolean
  onDone: () => void
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
          {Indicator && <Indicator progress={progress} />}
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
 */
function RecapPanel({
  variant,
  position,
}: {
  variant: ExperimentVariant
  position: string
}) {
  const Indicator = loadingIndicators[variant.id]

  return (
    // h-full so the pair fills the same box the canvas occupied.
    <div className="flex h-full flex-col items-center justify-center gap-4 rounded-lg border bg-muted/40 p-4">
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        {Indicator && <Indicator progress={1} />}
      </div>
      <div className="text-center">
        <p className="text-xs font-medium text-muted-foreground">{position}</p>
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
          toast.success('All ten matchups done — here are the standings.')
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
      <Card>
        <CardHeader>
          <CardTitle>Standings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <EloResults
            aggregate={aggregate.data}
            isLoading={aggregate.isLoading}
            deltas={deltas}
            voteCount={myMatches.length}
          />
          <Button variant="outline" onClick={restart}>
            {myMatches.length === 0 ? 'Take the experiment' : 'Take it again'}
          </Button>
        </CardContent>
      </Card>
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
                durationMs={matchup.durationAMs}
                loaded={stage === 'first-held'}
                onDone={() => setStage('first-held')}
              />
            )}

            {(stage === 'second' || stage === 'second-held') && (
              <StimulusCanvas
                key={`${round}-b`}
                variant={matchup.b}
                durationMs={matchup.durationBMs}
                loaded={stage === 'second-held'}
                onDone={() => setStage('second-held')}
              />
            )}

            {stage === 'voting' && (
              <div className="grid h-full gap-4 sm:grid-cols-2">
                <RecapPanel variant={matchup.a} position="First" />
                <RecapPanel variant={matchup.b} position="Second" />
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
