import { ArrowRight, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Mark } from '@/components/layout/mark'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { AccuracyScore } from '@/features/experiments/accuracy-score'
import { EloHistoryChart } from '@/features/experiments/elo-history-chart'
import { EloResults } from '@/features/experiments/elo-results'
import { HypothesisCard } from '@/features/experiments/hypothesis-card'
import { InterestingFindings } from '@/features/experiments/interesting-findings'
import { IndicatorPreview } from '@/features/experiments/indicator-preview'
import { loadingIndicators } from '@/features/experiments/indicators'
import { LoadedContent } from '@/features/experiments/loaded-content'
import { PairwiseIntro } from '@/features/experiments/pairwise-intro'
import { SeriesSwatch } from '@/features/experiments/series-colors'
import { useTimedProgress } from '@/features/experiments/use-timed-progress'
import {
  computeElo,
  rollMatchupDurations,
  roundRobinPairs,
  START_RATING,
} from '@/lib/data/aggregate'
import {
  useEloAggregate,
  useEloHistory,
  useMatchInsights,
  useRecordMatch,
} from '@/lib/data/hooks'
import type {
  EloAggregate,
  Experiment,
  ExperimentVariant,
  MatchInput,
  MatchOutcome,
} from '@/lib/data/types'
import { cn } from '@/lib/utils'
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
 * Redos allowed per matchup.
 *
 * One: enough to recover from a lapse in attention, which is what testers
 * actually reported, and not enough to shop for a result. Matches are
 * append-only, so a vote cast on a matchup nobody really watched can never be
 * retracted — the recovery has to happen before it is cast.
 */
const REDOS_PER_MATCHUP = 1

/**
 * Total height of the matchup area: badge row, stimulus frame, and the vote
 * block once it appears.
 *
 * Fixed, so the card is exactly as tall while an animation plays as it is while
 * you vote — the page never jumps. The frame inside simply flexes, reclaiming
 * the vote block's space during playback, which is when it is wanted.
 *
 * Grows past `sm`, into the room the hypothesis card gave back when it stopped
 * rendering during matchups. All of it lands on the stimulus frame, which is
 * where height is worth the most (see `STIMULUS_CANVAS`). Small screens stay at
 * the original height on purpose: they have the least to spare vertically, and
 * this card plus the vote block is already about as much as fits above the fold
 * on a phone.
 */
const MATCHUP_AREA = 'h-112 sm:h-136'

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
 * One of the two answers: the indicator that played, and the target you click
 * to vote for it.
 *
 * Renders the indicator itself at its end state, not the article it loaded —
 * the article is identical for every variant by design, so two copies of it
 * would be indistinguishable and anchor nothing.
 *
 * Being the vote is the point. Three buttons underneath made the participant
 * translate "the one on the left" into "the first button" at the exact moment
 * we want an unmediated judgement; here the thing being judged and the thing
 * being pressed are the same object.
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
  disabled,
  onVote,
}: {
  variant: ExperimentVariant
  position: string
  seed: number
  disabled: boolean
  onVote: () => void
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
    //
    // A bare <button> rather than `ui/button.tsx`, which is the one place in
    // this feature that departs from shadcn-first. That component is sized and
    // laid out as a control (`h-8`, `px-2.5`, a nowrap row); a panel that has
    // to fill its grid cell and stack an indicator above a label would have to
    // override all of it, and overriding six base utilities through `cn` is
    // less honest than borrowing the one thing that genuinely applies — the
    // system's focus ring, copied verbatim from `buttonVariants` so keyboard
    // focus looks the same here as everywhere else.
    //
    // The visible text says "First · Classic spinner", which names the panel
    // without saying what pressing it does, so the accessible name spells out
    // the vote being cast.
    <button
      type="button"
      disabled={disabled}
      onClick={onVote}
      aria-label={`${position} felt faster: ${variant.label}`}
      className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border bg-muted/40 p-2 transition-colors outline-none hover:border-foreground/30 hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60 sm:gap-4 sm:p-4"
    >
      {/*
        w-full because the panel is `items-center`, which leaves this box
        shrink-to-fit. Percentage-width children contribute nothing to intrinsic
        width, so a full-bleed indicator like the skeleton collapsed to the
        width of its one fixed-width bar (w-24) and rendered as a 96px sliver.

        min-h-0 + overflow-hidden is what keeps a full-frame indicator inside
        the panel — but it only bites because the grid pins the row height; see
        grid-rows there.

        items-safe-center rather than a breakpoint. This was `items-start` below
        sm and `items-center` above, which asked the screen width a question only
        the indicator can answer: the panel is ~114px on a phone, so a 48px
        spinner sat pinned to the top of an empty box with 66px under it, while
        the quote and the cooking pan overflow that height and have to start at
        the top or they lose their first line. One rule covers both — centre
        what fits, top-align what doesn't — and it keeps covering them if an
        indicator's size changes. See the utility in index.css.
      */}
      <div className="flex min-h-0 w-full flex-1 items-safe-center justify-center overflow-hidden">
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
    </button>
  )
}

/**
 * The way out of a matchup you couldn't judge.
 *
 * Quieter than the three answers on purpose: this is an escape hatch, not a
 * fourth thing you might mean. It also stays put once spent rather than
 * disappearing, so the cap reads as a rule of the experiment instead of as a
 * control that vanished — and the count is in the label so the rule is legible
 * before you press it, not only after.
 *
 * On screen through the whole matchup, and merely insensitive until the vote.
 * A control that appears at vote time is a control you have to notice and read
 * at the one moment you are trying to recall two animations; sitting there
 * inert the whole way through means it has already been read by the time it
 * matters. `live` says it is now pressable, which below sm is also when it can
 * afford its label — see the comment on the text.
 */
function RedoButton({
  redosLeft,
  live,
  disabled,
  onRedo,
}: {
  redosLeft: number
  live: boolean
  disabled: boolean
  onRedo: () => void
}) {
  const button = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={disabled}
      onClick={onRedo}
      // Fixed at every width, because the text below is not: on a phone the
      // label collapses to the icon while the button is inert, and an icon on
      // its own has no accessible name at all.
      aria-label={`Redo matchup (${redosLeft} left)`}
    >
      <RotateCcw />
      {/*
        Two trims, both for the phone header, which has ~311px to work with and
        has to hold the count, the stage label and this.

        While the button is inert, below sm, it is the icon alone: nothing here
        is pressable yet, so the space belongs to "First of two", which is live
        information about what is on screen. The label arrives when the button
        does — an affordance that grows exactly when it becomes usable — and by
        then the stage label has gone, so there is room for it.

        The other trim is permanent: "Redo (1 left)" below sm, because "matchup"
        is the word this control can afford to lose. It sits under a badge that
        has just said Matchup 4 of 15, so there is nothing else it could be
        redoing. The COUNT never goes — touch gets no tooltip (see below), so
        the label is the only place the cap is legible before you press it.
      */}
      <span className={cn('hidden sm:inline', live && 'inline')}>
        Redo<span className="hidden sm:inline"> matchup</span> ({redosLeft}{' '}
        left)
      </span>
    </Button>
  )

  // Nothing to explain while one is still there to spend — and a tooltip on a
  // live control would just restate its own label.
  if (redosLeft > 0) return button

  return (
    <Tooltip>
      {/*
        The span is the trigger, not the button: `disabled` buttons fire no
        pointer events (the variants set `disabled:pointer-events-none`), so a
        disabled control can never be its own trigger. `tabIndex` keeps the
        explanation reachable without a mouse, since the button itself has
        dropped out of the tab order.

        Note this leaves touch without the explanation — Radix tooltips do not
        open on tap. That is why the cap also lives in the label, where every
        input method can read it.
      */}
      <TooltipTrigger asChild>
        <span tabIndex={0}>{button}</span>
      </TooltipTrigger>
      <TooltipContent>You get one redo per matchup.</TooltipContent>
    </Tooltip>
  )
}

/** `{ variantId: rating }`, the shape `computeElo` seeds from. */
function ratingsById(aggregate: EloAggregate): Record<string, number> {
  return Object.fromEntries(
    aggregate.ratings.map((r) => [r.variantId, r.rating]),
  )
}

export function PairwiseRunner({
  experiment,
  startAtResults = false,
}: {
  experiment: Experiment
  /**
   * Open straight on the standings, as if the intro card's "Skip to results"
   * had already been clicked. Read once, at mount: restarting from the results
   * screen has to be able to leave, so this cannot keep pulling `phase` back.
   */
  startAtResults?: boolean
}) {
  const visitorId = getVisitorId()
  const recordMatch = useRecordMatch()

  const [plan, setPlan] = useState(() => buildRunPlan(experiment.variants))
  const [round, setRound] = useState(0)
  const [stage, setStage] = useState<Stage>('idle')
  // `intro` gates the whole thing behind an explanation; `results` is reached
  // either by finishing a run, by skipping straight there, or by arriving on a
  // link that already asked for it.
  const [phase, setPhase] = useState<'intro' | 'playing' | 'results'>(
    startAtResults ? 'results' : 'intro',
  )
  const [myMatches, setMyMatches] = useState<MatchInput[]>([])
  // Keyed by round rather than a boolean that resets as the round advances:
  // `round` only ever moves forward, so this needs clearing in exactly one
  // place (`restart`), with no second reset site to forget later.
  const [redoneRounds, setRedoneRounds] = useState<ReadonlySet<number>>(
    new Set(),
  )

  // Enabled from mount, not just at the end, so we can capture the standings as
  // they were BEFORE this run. Nothing renders it until `phase` is 'results',
  // which is reached either by playing or by explicitly skipping.
  const aggregate = useEloAggregate(experiment.id)
  // Its own query, not part of `aggregate`: it is only ever read on the results
  // screen, where the chart it feeds renders under the standings table.
  const history = useEloHistory(experiment.id)
  // The third read of the same match log. Enabled from mount like the other
  // two, so the card is already answered by the time the run reaches it.
  const insights = useMatchInsights(experiment.id)

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
  const redosLeft = REDOS_PER_MATCHUP - (redoneRounds.has(round) ? 1 : 0)

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
    setRedoneRounds(new Set())
    setSnapshot(aggregate.data ? ratingsById(aggregate.data) : undefined)
    setPhase('playing')
  }

  /**
   * Replay the current matchup from the top.
   *
   * Deliberately the SAME `plan[round]` — same variants, same order, same
   * durations, same seed. Re-rolling any of that is what would make a redo
   * worth gaming, and the durations in particular are what `computeElo`'s
   * handicap corrects for, so the recorded match has to describe what was
   * actually watched.
   *
   * Goes back to 'idle' rather than straight to 'first': the whole point is
   * that attention had wandered, so the participant chooses when it restarts.
   * That also remounts the canvas, which matters — `useTimedProgress` does not
   * reset its progress when merely re-run, so a redo that kept the canvas
   * mounted would sit on the previous pass's end state until the first frame.
   */
  const redo = () => {
    if (stage !== 'voting' || redosLeft === 0 || recordMatch.isPending) return
    setRedoneRounds((prev) => new Set(prev).add(round))
    setStage('idle')
  }

  const vote = (outcome: MatchOutcome) => {
    // Belt and braces: the panels and the tie link only render at 'voting', but
    // a stray call here would record a match for a matchup nobody watched.
    if (stage !== 'voting' || recordMatch.isPending) return
    const input: MatchInput = {
      experimentId: experiment.id,
      visitorId,
      variantAId: matchup.a.id,
      variantBId: matchup.b.id,
      durationAMs: matchup.durationAMs,
      durationBMs: matchup.durationBMs,
      outcome,
      // Recorded on the vote rather than as its own row: a redo produces no
      // judgement of its own, it just changes how the one judgement was
      // arrived at.
      redone: redoneRounds.has(round),
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
      // The panels go sensitive again so the vote can simply be retried.
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
        {myMatches.length > 0 && (
          <AccuracyScore matches={myMatches} variants={experiment.variants} />
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mark className="size-5" />
              Global standings
            </CardTitle>
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
                const i = experiment.variants.findIndex(
                  (v) => v.id === r.variantId,
                )
                const variant = experiment.variants[i]
                return (
                  <span className="flex items-center gap-2">
                    {/*
                      The chart's key, repeated on the row it belongs to. The
                      table and the chart are the same six loading states twice,
                      and without this the only way across was matching labels
                      by eye. Left of the name because that is the edge the eye
                      runs down when it comes back up from the chart.

                      Only for a variant the experiment still declares: the
                      colour is its declared position, and there is no honest
                      slot for a row the seed no longer has.
                    */}
                    {i >= 0 && <SeriesSwatch index={i} />}
                    {variant ? <IndicatorPreview variant={variant} /> : r.label}
                  </span>
                )
              }}
              // Inverted for the same reason as `renderLabel`: the standings
              // render from an aggregate, and a trajectory needs the seeded
              // variants to colour and name its lines.
              chart={
                <EloHistoryChart
                  experiment={experiment}
                  history={history.data}
                  isLoading={history.isLoading}
                />
              }
            />
          </CardContent>
        </Card>

        {/*
          Below the standings and above the hypothesis: it is a second reading
          of the same global corpus, so it belongs with the table rather than
          with the personal score, and the hypothesis stays last as the thing
          all of it is evidence about.

          Ungated, unlike `AccuracyScore`. Every finding is about the whole
          experiment, so there is nothing here that needs the visitor to have
          played.
        */}
        <InterestingFindings
          insights={insights.data}
          isLoading={insights.isLoading}
          variants={experiment.variants}
        />

        <HypothesisCard experiment={experiment} />
      </div>
    )
  }

  if (phase === 'intro') {
    return (
      // Same self-contained spacing as the results phase above.
      <div className="space-y-6">
        <PairwiseIntro
          experiment={experiment}
          onStart={() => setPhase('playing')}
          onSkip={() => setPhase('results')}
        />

        <HypothesisCard experiment={experiment} />
      </div>
    )
  }

  // Falls through to the matchups, which render no hypothesis: it is one more
  // thing to read while the whole point is to watch the loading states.

  return (
    <Card>
      <CardHeader className="gap-3">
        {/*
          Count left, redo right, which-of-the-two centred. From sm the two 1fr
          sides are equal by construction, so the middle label sits on the
          card's centre line rather than wherever the count leaves it.

          No question here any more: the vote prompt below the animations asks
          it, right where it is answered, and asking twice on one card only made
          the header compete with the thing being watched.

          Everything here renders in every stage, so this row never grows: it
          sits above a fixed-height content area, and anything appearing at vote
          time would shove the whole card down at the exact moment the two
          animations are being compared from memory. What changes between stages
          is only whether a thing is sensitive — the redo — or blank — the stage
          label, which has nothing to say before a run starts or after it ends.

          Below sm all three have to share ~311px (a 375px screen, less the page
          gutter and the card padding), which is why the phone gets two
          concessions the desktop does not. The blank stage label collapses
          rather than reserving its width, and the inert redo is icon-only; both
          are sized by `RedoButton`'s and the label's own classes. The two
          concessions never bite at once, because the label is blank exactly
          when the redo comes alive.
        */}
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <Badge variant="secondary" className="justify-self-start">
            Matchup {round + 1} of {plan.length}
          </Badge>
          {/*
            Plain text rather than a second pill: two badges side by side read
            as two things of equal weight, and this one is a running commentary
            on the animation, not a fact about the run. Styled like the recap
            panels' "First"/"Second", which name the same two positions.

            Blank between runs, and how it goes blank differs by width. From sm
            it stays `invisible` inside a `min-w` reserve wide enough for the
            longer of its two strings, so the centred column never changes size
            as a run starts or the second variant comes up. Below sm it is
            `hidden` instead: the reserve is 96px the phone does not have, and
            the only thing that would move to claim it is the redo beside it,
            which is right-anchored and stays put.
          */}
          <p
            className={cn(
              'col-start-2 row-start-1 text-center text-xs font-medium text-muted-foreground sm:min-w-24',
              (stage === 'idle' || stage === 'voting') &&
                'hidden sm:invisible sm:block',
            )}
          >
            {stage.startsWith('first') ? 'First of two' : 'Second of two'}
          </p>
          <div className="col-start-3 row-start-1 justify-self-end">
            <RedoButton
              redosLeft={redosLeft}
              live={stage === 'voting'}
              disabled={
                stage !== 'voting' || redosLeft === 0 || recordMatch.isPending
              }
              onRedo={redo}
            />
          </div>
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
        {/*
          The prompt only, now that the two answers are the panels below it. It
          appears with them rather than sitting there through the matchup: a
          question you cannot yet answer reads as broken, and it would compete
          with the animation being watched.

          Appearing costs the frame some height rather than growing the card:
          MATCHUP_AREA fixes the total, so the stimulus simply hands back the
          space it borrowed during playback and nothing on the page moves.

          Not `experiment.metricLabel`: that field names the metric for surfaces
          that only report it, and half of this sentence is about how to work
          this particular screen. Wiring an interaction instruction into a data
          row would put it on the results header too.

          The tie rides this line rather than taking a row below the panels.
          MATCHUP_AREA is fixed, so a row there comes straight out of the recap
          panels — already down to ~114px each below sm, where the height is
          worth more than the tidier reading order. As a link, because this is
          the answer you give when neither panel is the answer, and a third
          button of equal weight is exactly what this change set out to remove.
        */}
        {stage === 'voting' && (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="text-sm font-medium">
              Which loading state felt faster? Click on one below to vote.
            </p>
            {/*
              px-0 so the words line up with the card's edges rather than
              sitting a padding's width inside them. It matters below sm, where
              this wraps onto its own line under the prompt: a link variant
              draws no box, so its inherited horizontal padding read as the text
              being indented from the sentence above it for no reason.

              ml-auto is what puts it on the right below sm. `justify-between`
              only spreads items that share a line — once this wraps it is alone
              on its own line and lands back at the left, directly under the
              start of the prompt, where it read as a third line of that
              sentence rather than as the control it is. From sm up the two do
              share a line and the margin collapses to nothing, so this changes
              only the wrapped case.
            */}
            <Button
              type="button"
              variant="link"
              size="sm"
              className="ml-auto px-0 text-muted-foreground"
              disabled={recordMatch.isPending}
              onClick={() => vote('tie')}
            >
              Too close to call
            </Button>
          </div>
        )}

        {/* The frame. Identical for both variants in a matchup, which is what
            keeps footprint from becoming a second independent variable. */}
        <div className="min-h-0 flex-1">
          {stage === 'idle' && (
            // The trigger sits where the loading state is about to appear, so
            // the eye is already on the right spot when playback starts.
            <div className={STIMULUS_CANVAS}>
              <div className="flex h-full items-center justify-center">
                <Button type="button" onClick={() => setStage('first')}>
                  {/*
                    "Replay" on a redone round. Without it a redo lands on a
                    screen identical to the one before the matchup first played,
                    and nothing confirms the press did anything.
                  */}
                  {redosLeft === 0 ? 'Replay' : 'Start'} matchup {round + 1}
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
                disabled={recordMatch.isPending}
                onVote={() => vote('a')}
              />
              <RecapPanel
                variant={matchup.b}
                position="Second"
                seed={matchup.seed}
                disabled={recordMatch.isPending}
                onVote={() => vote('b')}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
