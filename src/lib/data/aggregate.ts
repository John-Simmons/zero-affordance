/**
 * Pure aggregation helpers shared by every adapter.
 *
 * Keeping this backend-agnostic means the mock and Supabase adapters compute
 * identical results from a list of raw responses/interactions — the only
 * difference between adapters is *where the rows come from*.
 */
import type {
  EloAggregate,
  EloHistory,
  EloHistoryPoint,
  EloRating,
  Experiment,
  AccuracyBucket,
  AccuracySpread,
  ContradictionStats,
  ExperimentAggregate,
  GapAccuracyBucket,
  HandicapRecord,
  InteractionInput,
  MatchInput,
  MatchInsights,
  PairRecord,
  RedoRecord,
  ReplayAccuracy,
  QuestionAggregate,
  Survey,
  SurveyAggregate,
  SurveyResponseInput,
} from '@/lib/data/types'

export function aggregateSurvey(
  survey: Survey,
  responses: SurveyResponseInput[],
): SurveyAggregate {
  const questions: QuestionAggregate[] = survey.questions.map((q) => {
    if (q.type === 'single_choice' || q.type === 'multiple_choice') {
      const optionCounts: Record<string, number> = {}
      for (const opt of q.options ?? []) optionCounts[opt.id] = 0
      for (const r of responses) {
        const a = r.answers[q.id]
        if (Array.isArray(a)) {
          a.forEach((id) => (optionCounts[id] = (optionCounts[id] ?? 0) + 1))
        } else if (typeof a === 'string') {
          optionCounts[a] = (optionCounts[a] ?? 0) + 1
        }
      }
      const total = Object.values(optionCounts).reduce((x, y) => x + y, 0)
      return { questionId: q.id, type: q.type, total, optionCounts }
    }

    if (q.type === 'scale') {
      const scaleCounts: Record<number, number> = {}
      let sum = 0
      let total = 0
      for (const r of responses) {
        const a = r.answers[q.id]
        if (typeof a === 'number') {
          scaleCounts[a] = (scaleCounts[a] ?? 0) + 1
          sum += a
          total += 1
        }
      }
      return {
        questionId: q.id,
        type: q.type,
        total,
        scaleCounts,
        scaleAverage: total ? sum / total : 0,
      }
    }

    // text
    const textSamples = responses
      .map((r) => r.answers[q.id])
      .filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
      .slice(-5)
      .reverse()
    return {
      questionId: q.id,
      type: q.type,
      total: textSamples.length,
      textSamples,
    }
  })

  return {
    surveyId: survey.id,
    totalResponses: responses.length,
    questions,
  }
}

export function aggregateExperiment(
  experiment: Experiment,
  interactions: InteractionInput[],
): ExperimentAggregate {
  const variants = experiment.variants.map((v) => {
    const distribution: Record<number, number> = {}
    let sum = 0
    let count = 0
    for (const i of interactions) {
      if (i.variantId !== v.id) continue
      distribution[i.value] = (distribution[i.value] ?? 0) + 1
      sum += i.value
      count += 1
    }
    return {
      variantId: v.id,
      label: v.label,
      count,
      average: count ? sum / count : 0,
      distribution,
    }
  })

  return {
    experimentId: experiment.id,
    totalInteractions: variants.reduce((x, v) => x + v.count, 0),
    variants,
  }
}

// ---------------------------------------------------------------------------
// Elo for pairwise experiments
// ---------------------------------------------------------------------------

/** Every variant starts here, so ratings are readable relative to 1500. */
export const START_RATING = 1500

/** How far a single result can move a rating. Standard chess-style K. */
export const K_FACTOR = 24

/**
 * Rating points a variant would be "spotted" for being *entirely* shorter than
 * its opponent — i.e. at a relative difference of 1.0.
 *
 * A shorter loading animation is genuinely more likely to be judged faster, so
 * winning that way is less informative. Rather than adjusting the delta after
 * the fact, the known advantage is folded into the *expected* score — the same
 * trick used to model white's first-move advantage in chess.
 *
 * The handicap is RELATIVE, not a flat rate per millisecond. How detectable a
 * duration gap is scales with the durations themselves (Weber's law): 400ms
 * separating two 2.5s waits is obvious, the same 400ms separating two 10s waits
 * is not. An absolute rate is silently calibrated to whatever base duration
 * happened to be in the seed when it was written, and would quietly mis-rate
 * every match if those durations changed.
 *
 * Calibration: the two sides of a matchup sit within
 * {@link DURATION_JITTER_FRACTION} of a shared base, so the widest gap between
 * them is twice that — 16% relative, whatever the base happens to be. At 900
 * points that implies a ~0.70 expected score for the shorter one, roughly twice
 * the just-noticeable difference for waits this long: clearly perceptible but
 * not a foregone conclusion.
 *
 * That the gap is expressed as a fraction is what keeps this paragraph true.
 * The previous version reasoned from a fixed 2500ms base and a fixed ±200ms,
 * and would have gone stale the moment the base started varying.
 */
export const DURATION_HANDICAP_FULL = 900

/**
 * The band a matchup's shared base duration is drawn from.
 *
 * One base per matchup, re-rolled for the next, so no participant can learn how
 * long "a wait" is here and start scoring against a remembered yardstick rather
 * than against what they just watched. Fifteen matchups at a constant base gave
 * fourteen chances to calibrate; this gives none.
 *
 * Both variants in a matchup share the base — varying it *within* a matchup
 * would put duration back in competition with the animation itself, which is
 * the one thing the design is trying to isolate.
 */
export const BASE_DURATION_MIN_MS = 1800
export const BASE_DURATION_MAX_MS = 3600

/**
 * The middle of the duration band, as one number.
 *
 * The reference wait for anything that has to turn a relative quantity back
 * into milliseconds — no matchup is guaranteed to run at it, but it is the
 * length a typical one has.
 */
export const MEAN_BASE_DURATION_MS =
  (BASE_DURATION_MIN_MS + BASE_DURATION_MAX_MS) / 2

/**
 * What a gap of `ratingPoints` is worth in real time, on a wait of
 * `referenceDurationMs`.
 *
 * The inverse of the handicap, and that is the whole claim it makes. The model
 * spots the longer side {@link DURATION_HANDICAP_FULL} points for a relative
 * duration difference of 1.0, so a rating lead of D points is exactly cancelled
 * by running `D / DURATION_HANDICAP_FULL` of the wait longer: put a variant D
 * ahead against one that far behind on the clock and `expectedScore` returns a
 * coin flip. That is what makes "this loading state is worth 150ms" a statement
 * about the model rather than a metaphor about it.
 *
 * At the middle of the band it works out at about 3ms a point, but the
 * reference is a parameter rather than baked in — the same rating gap buys more
 * milliseconds on a longer wait, which is the whole reason the handicap is
 * relative in the first place.
 *
 * Derived, not measured. Nobody timed a participant's sense of a wait; this is
 * the ratings read back through the model that produced them, and it inherits
 * every assumption in {@link DURATION_HANDICAP_FULL}.
 */
export function perceivedMs(
  ratingPoints: number,
  referenceDurationMs: number,
): number {
  return (ratingPoints / DURATION_HANDICAP_FULL) * referenceDurationMs
}

/**
 * How far each side may deviate from its matchup's base, as a fraction of it.
 *
 * A fraction rather than a fixed number of milliseconds so the judgement is
 * equally hard at every base — the same reasoning that makes the handicap above
 * relative. At a fixed ±200ms the gap would be 22% of an 1800ms base but 11% of
 * a 3600ms one, and "how obvious was the difference" would quietly become a
 * second variable riding along with the base.
 */
export const DURATION_JITTER_FRACTION = 0.08

/**
 * The two durations for one matchup: a shared base from the band, then an
 * independent jitter each.
 *
 * `rand` is injected rather than reaching for `Math.random` so the mock
 * provider can generate a reproducible baseline from a seeded generator while
 * the live runner stays genuinely random. Both must roll durations the same
 * way — the Elo handicap reads these numbers, so a baseline built on a
 * different model would be rated on a different scale from real votes.
 *
 * The two can still land on the same millisecond, roughly once every thirty
 * runs. {@link scoreAccuracy} drops those rather than marking them, because
 * there was no shorter one to have picked.
 */
export function rollMatchupDurations(rand: () => number): {
  durationAMs: number
  durationBMs: number
} {
  const base =
    BASE_DURATION_MIN_MS +
    rand() * (BASE_DURATION_MAX_MS - BASE_DURATION_MIN_MS)
  const spread = base * DURATION_JITTER_FRACTION
  const roll = () => Math.round(base + (rand() * 2 - 1) * spread)
  return { durationAMs: roll(), durationBMs: roll() }
}

/** Probability `ratingA` beats `ratingB`, given A's duration handicap. */
function expectedScore(
  ratingA: number,
  ratingB: number,
  durationAMs: number,
  durationBMs: number,
): number {
  const mean = (durationAMs + durationBMs) / 2
  // Guarded so a zero-duration variant can't produce Infinity/NaN ratings.
  const relative = mean > 0 ? (durationBMs - durationAMs) / mean : 0
  const handicapA = relative * DURATION_HANDICAP_FULL
  return 1 / (1 + 10 ** ((ratingB - ratingA - handicapA) / 400))
}

/** Every declared variant at its opening rating, ready to be replayed into. */
function startingRatings(
  experiment: Experiment,
  initialRatings?: Record<string, number>,
): Map<string, EloRating> {
  return new Map(
    experiment.variants.map((v) => [
      v.id,
      {
        variantId: v.id,
        label: v.label,
        rating: initialRatings?.[v.id] ?? START_RATING,
        matches: 0,
        wins: 0,
        losses: 0,
        ties: 0,
      },
    ]),
  )
}

/**
 * Whether a match is one the experiment can be rated on.
 *
 * Matches naming a variant the experiment no longer declares are skipped, so
 * removing a variant degrades gracefully instead of throwing.
 */
function counts(byId: Map<string, EloRating>, m: MatchInput): boolean {
  return (
    m.variantAId !== m.variantBId &&
    byId.has(m.variantAId) &&
    byId.has(m.variantBId)
  )
}

/**
 * Apply one match to `byId` in place, reporting whether it counted.
 *
 * Extracted so {@link computeElo} and {@link computeEloHistory} share one
 * definition of what a match does to a rating. Two copies of this loop would
 * eventually drift, and the drift would show up as a chart that disagrees with
 * the table printed beside it.
 */
function applyMatch(byId: Map<string, EloRating>, m: MatchInput): boolean {
  if (!counts(byId, m)) return false
  const a = byId.get(m.variantAId)!
  const b = byId.get(m.variantBId)!

  const expectedA = expectedScore(
    a.rating,
    b.rating,
    m.durationAMs,
    m.durationBMs,
  )
  const scoreA = m.outcome === 'a' ? 1 : m.outcome === 'b' ? 0 : 0.5
  const delta = K_FACTOR * (scoreA - expectedA)

  // Zero-sum: whatever A gains, B loses.
  a.rating += delta
  b.rating -= delta

  a.matches += 1
  b.matches += 1
  if (m.outcome === 'tie') {
    a.ties += 1
    b.ties += 1
  } else if (m.outcome === 'a') {
    a.wins += 1
    b.losses += 1
  } else {
    a.losses += 1
    b.wins += 1
  }
  return true
}

/**
 * Replay `matches` in order to derive each variant's current Elo rating.
 *
 * IMPORTANT: unlike every other function in this module, this one is
 * order-dependent — Elo is path-dependent by construction. Callers must pass
 * matches in a stable order (adapters sort by createdAt, then by a tiebreaker)
 * or the same data will yield different ratings on different reads.
 *
 * `initialRatings` starts variants somewhere other than {@link START_RATING},
 * which is how a single participant's contribution is isolated: replay only
 * their matches, seeded with the ratings as they stood before they played, and
 * the difference is exactly what they caused. Seeding matters because a match's
 * delta depends on the ratings at the moment it was applied — the same vote
 * moves the needle differently depending on what came before it. Variants absent
 * from the map fall back to START_RATING.
 *
 * Matches the experiment cannot be rated on are skipped — see {@link counts}.
 */
/**
 * How many distinct people are behind a set of rows.
 *
 * Shared so every adapter answers the catalogue's head-count the same way, and
 * so it means what {@link computeElo}'s `totalParticipants` means: one visitor
 * is one participant however many rows they left behind.
 *
 * Takes anything with a `visitorId`, because a participant is a participant
 * whether they voted on matchups, rated a variant, or answered a survey.
 */
export function countParticipants(
  rows: readonly { visitorId: string }[],
): number {
  return new Set(rows.map((r) => r.visitorId)).size
}

export function computeElo(
  experiment: Experiment,
  matches: MatchInput[],
  initialRatings?: Record<string, number>,
): EloAggregate {
  const byId = startingRatings(experiment, initialRatings)

  let totalMatches = 0
  // Counted from the matches that actually applied rather than from `matches`,
  // so the headcount can never claim participants the ratings never saw.
  const participants = new Set<string>()
  for (const m of matches) {
    if (applyMatch(byId, m)) {
      totalMatches += 1
      participants.add(m.visitorId)
    }
  }

  const ratings = [...byId.values()].sort(
    (x, y) => y.rating - x.rating || x.label.localeCompare(y.label),
  )

  return {
    experimentId: experiment.id,
    totalMatches,
    totalParticipants: participants.size,
    ratings,
  }
}

/**
 * How many states {@link computeEloHistory} keeps.
 *
 * Enough to show the shape of a trajectory, few enough that six overlaid lines
 * stay readable and the payload stays small. The cap is on the *output*: every
 * match is still replayed, so the sampling cannot change the ratings.
 */
export const MAX_HISTORY_POINTS = 60

/**
 * Ratings sampled along the same replay {@link computeElo} ends at.
 *
 * Shares {@link applyMatch}, so this is the identical computation observed part
 * way through rather than a second implementation of it. The final point is
 * therefore exactly what `computeElo` reports for the same matches — the one
 * invariant worth protecting here, since the chart and the standings table are
 * shown side by side.
 *
 * Sampling every nth state rather than every state preserves path-dependence
 * (see {@link computeElo}): matches are never skipped, only snapshots.
 */
export function computeEloHistory(
  experiment: Experiment,
  matches: MatchInput[],
): EloHistory {
  const byId = startingRatings(experiment)
  const snapshot = (matchCount: number): EloHistoryPoint => ({
    matchCount,
    ratings: Object.fromEntries(
      [...byId.values()].map((r) => [r.variantId, r.rating]),
    ),
  })

  // Filtered up front rather than counted as we go: the stride needs the total
  // before the walk starts, and skipped rows must not advance the x-axis past
  // the total the standings report.
  const counted = matches.filter((m) => counts(byId, m))
  const stride = Math.max(
    1,
    Math.ceil(counted.length / (MAX_HISTORY_POINTS - 1)),
  )

  // Opens at the origin so the chart shows every variant leaving 1500 together
  // rather than starting mid-flight.
  const points: EloHistoryPoint[] = [snapshot(0)]
  counted.forEach((m, i) => {
    applyMatch(byId, m)
    const n = i + 1
    // The last point is always emitted, whatever the stride lands on.
    if (n % stride === 0 || n === counted.length) points.push(snapshot(n))
  })

  return {
    experimentId: experiment.id,
    totalMatches: counted.length,
    points,
  }
}

/**
 * Where the gap buckets in {@link computeMatchInsights} are cut, as fractions
 * of a matchup's mean duration.
 *
 * Sized against the spread the runner can actually produce, not chosen round:
 * both sides share one base and jitter by at most
 * {@link DURATION_JITTER_FRACTION} either way, so a relative gap cannot exceed
 * ~16% and most land nearer 6%. Cutting at 4% and 9% puts roughly a third of
 * matchups in each bucket, which is what makes the three rates comparable.
 *
 * Edges are exclusive upper bounds; anything above the last one is the
 * open-ended top bucket.
 */
export const GAP_BUCKET_EDGES = [0.04, 0.09]

/**
 * Matches a finding wants behind it before its number means much.
 *
 * Not enforced here — {@link computeMatchInsights} reports every count it has
 * and the UI decides what to say about a thin one. It lives beside the
 * computation because the threshold is a property of the statistic, not of the
 * card that renders it.
 */
export const MIN_FINDING_SAMPLE = 20

/**
 * Marked matchups one person needs before their score is placed on the spread.
 *
 * A run is fifteen matchups, so this is a third of one — enough that a score is
 * not one lucky guess, low enough to keep anyone who abandoned a run part way.
 * Without a floor a visitor who judged a single matchup correctly would land on
 * 100% and dent the shape of the whole distribution.
 */
export const MIN_SCORED_PER_VISITOR = 5

/**
 * Width of the bands individual scores are grouped into, in percentage points.
 *
 * Five bands over the range. Fewer hides the thing worth seeing — whether the
 * distribution has one hump or two — and more spreads a few hundred people so
 * thin that every band is noise.
 */
export const ACCURACY_BUCKET_WIDTH = 20

/** `[a, b]` in a fixed order, so one pairing has one row however it was played. */
function pairKey(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x]
}

/**
 * The findings for an experiment there is nothing to say about.
 *
 * Shared rather than written out in each adapter. Both of them need this for
 * an id they do not recognise, and a literal in two files grows a field at a
 * time until the two disagree about what "empty" is.
 */
export function emptyMatchInsights(experimentId: string): MatchInsights {
  return computeMatchInsights(
    {
      id: experimentId,
      slug: '',
      title: '',
      description: '',
      hypothesis: '',
      kind: 'pairwise',
      metricLabel: '',
      metricMin: 0,
      metricMax: 0,
      variants: [],
    },
    [],
  )
}

/**
 * The questions the standings cannot answer, from the same match log.
 *
 * Every finding here is a fold, so unlike {@link computeElo} the ORDER of
 * `matches` does not change the answer. It still walks them through
 * {@link applyMatch} rather than filtering them itself, because that function
 * owns the definition of a match the experiment can be rated on — and
 * `totalMatches` has to mean here exactly what it means in the standings
 * printed above these findings.
 */
export function computeMatchInsights(
  experiment: Experiment,
  matches: MatchInput[],
): MatchInsights {
  const byId = startingRatings(experiment)

  // Totals rather than running means: a mean of means would weight a variant's
  // first win as heavily as its fiftieth.
  const gaps = new Map<string, { wins: number; ms: number; relative: number }>(
    experiment.variants.map((v) => [v.id, { wins: 0, ms: 0, relative: 0 }]),
  )
  const pairs = new Map<string, PairRecord>()
  const redos = new Map<string, RedoRecord>(
    experiment.variants.map((v) => [
      v.id,
      { variantId: v.id, label: v.label, replayed: 0, matches: 0 },
    ]),
  )
  const replayAccuracy: ReplayAccuracy = {
    replayed: { correct: 0, scored: 0 },
    firstView: { correct: 0, scored: 0 },
  }
  /*
    One entry per person: what they decided each pairing to be, and how their
    own votes scored. Keyed by pairing rather than appended, so someone who
    played twice contributes one opinion per pairing — their latest. Two runs
    disagreeing with each other is a real thing to measure, but it is not the
    thing this measures, and folding it in here would report it as a circular
    triple it is not.
  */
  const visitors = new Map<
    string,
    { decided: Map<string, string>; correct: number; scored: number }
  >()
  const buckets: GapAccuracyBucket[] = [...GAP_BUCKET_EDGES, null].map(
    (maxRelativeGap) => ({ maxRelativeGap, correct: 0, scored: 0 }),
  )
  const positionSplit = { first: 0, second: 0, ties: 0 }

  let totalMatches = 0

  for (const m of matches) {
    if (!applyMatch(byId, m)) continue
    totalMatches += 1

    const visitor = visitors.get(m.visitorId) ?? {
      decided: new Map<string, string>(),
      correct: 0,
      scored: 0,
    }
    visitors.set(m.visitorId, visitor)

    for (const id of [m.variantAId, m.variantBId]) {
      const redo = redos.get(id)!
      redo.matches += 1
      if (m.redone) redo.replayed += 1
    }

    // `matchVerdict` rather than a second comparison of the two durations, so
    // every accuracy number on this screen — the participant's own score, the
    // gap buckets, these two — is the same rule applied to different subsets.
    const verdict = matchVerdict(m)
    if (verdict === 'correct' || verdict === 'wrong') {
      const bucket = m.redone
        ? replayAccuracy.replayed
        : replayAccuracy.firstView
      bucket.scored += 1
      visitor.scored += 1
      if (verdict === 'correct') {
        bucket.correct += 1
        visitor.correct += 1
      }
    }

    const mean = (m.durationAMs + m.durationBMs) / 2
    const relativeGap =
      mean > 0 ? Math.abs(m.durationAMs - m.durationBMs) / mean : 0

    const [x, y] = pairKey(m.variantAId, m.variantBId)
    const pair = pairs.get(`${x}:${y}`) ?? {
      aId: x,
      bId: y,
      aWins: 0,
      bWins: 0,
      ties: 0,
    }
    pairs.set(`${x}:${y}`, pair)

    if (m.outcome === 'tie') {
      positionSplit.ties += 1
      pair.ties += 1
      // Every finding below asks something about a winner, and a tie names
      // none. It is counted, not silently dropped, so the denominators the UI
      // prints add back up to `totalMatches`.
      continue
    }

    const wonA = m.outcome === 'a'
    if (wonA) positionSplit.first += 1
    else positionSplit.second += 1
    if (wonA === (m.variantAId === x)) pair.aWins += 1
    else pair.bWins += 1
    visitor.decided.set(`${x}:${y}`, wonA ? m.variantAId : m.variantBId)

    const winnerId = wonA ? m.variantAId : m.variantBId
    const winnerMs = wonA ? m.durationAMs : m.durationBMs
    const loserMs = wonA ? m.durationBMs : m.durationAMs
    if (winnerMs > loserMs) {
      const gap = gaps.get(winnerId)!
      gap.wins += 1
      gap.ms += winnerMs - loserMs
      gap.relative += relativeGap
    }

    // A dead heat has no shorter side to have picked, so it belongs in no
    // bucket — the same row `matchVerdict` calls `no-shorter`.
    if (m.durationAMs !== m.durationBMs) {
      const bucket =
        buckets.find(
          (b) => b.maxRelativeGap !== null && relativeGap < b.maxRelativeGap,
        ) ?? buckets[buckets.length - 1]
      bucket.scored += 1
      if (winnerMs < loserMs) bucket.correct += 1
    }
  }

  return {
    experimentId: experiment.id,
    totalMatches,
    handicaps: [...gaps.entries()]
      .map(([variantId, g]): HandicapRecord => {
        const variant = experiment.variants.find((v) => v.id === variantId)!
        return {
          variantId,
          label: variant.label,
          wins: g.wins,
          meanGapMs: g.wins === 0 ? 0 : g.ms / g.wins,
          meanRelativeGap: g.wins === 0 ? 0 : g.relative / g.wins,
        }
      })
      .sort(
        (x, y) => y.meanGapMs - x.meanGapMs || x.label.localeCompare(y.label),
      ),
    positionSplit,
    gapAccuracy: buckets,
    pairRecords: [...pairs.values()].sort(
      (x, y) => x.aId.localeCompare(y.aId) || x.bId.localeCompare(y.bId),
    ),
    replayAccuracy,
    redos: [...redos.values()].sort(
      (x, y) => replayRate(y) - replayRate(x) || x.label.localeCompare(y.label),
    ),
    contradictions: countContradictions(experiment, visitors),
    accuracySpread: spreadOf(visitors),
  }
}

/** Share of a variant's matchups that were replayed. Zero when it has none. */
function replayRate(r: RedoRecord): number {
  return r.matches === 0 ? 0 : r.replayed / r.matches
}

/**
 * Circular triples, counted per person.
 *
 * A triple of three variants is transitive when the three results between them
 * give one variant two wins, one variant one, and one variant none. Circular is
 * the only other possibility: every variant with exactly one win. Counting wins
 * is why this needs no case analysis of which way round the cycle runs.
 *
 * Only complete triples are counted — all three pairings decided by the same
 * person — so a run with ties in it contributes its intact triples and no more.
 */
function countContradictions(
  experiment: Experiment,
  visitors: Map<string, { decided: Map<string, string> }>,
): ContradictionStats {
  const ids = experiment.variants.map((v) => v.id)
  const stats: ContradictionStats = {
    cyclic: 0,
    triples: 0,
    visitorsWithCycle: 0,
    visitorsScored: 0,
  }

  for (const { decided } of visitors.values()) {
    let scored = false
    let cycled = false

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        for (let k = j + 1; k < ids.length; k++) {
          const winners = [
            [ids[i], ids[j]],
            [ids[i], ids[k]],
            [ids[j], ids[k]],
          ].map(([x, y]) => decided.get(`${pairKey(x, y).join(':')}`))
          if (winners.some((w) => w === undefined)) continue

          scored = true
          stats.triples += 1
          const wins = new Map([
            [ids[i], 0],
            [ids[j], 0],
            [ids[k], 0],
          ])
          for (const w of winners) wins.set(w!, (wins.get(w!) ?? 0) + 1)
          if ([...wins.values()].every((n) => n === 1)) {
            stats.cyclic += 1
            cycled = true
          }
        }
      }
    }

    if (scored) stats.visitorsScored += 1
    if (cycled) stats.visitorsWithCycle += 1
  }

  return stats
}

/**
 * Individual scores, grouped into bands.
 *
 * The bands are built from {@link ACCURACY_BUCKET_WIDTH} rather than written
 * out, so the whole range is always covered and the top one always includes
 * 100 — a distribution missing its best scores would be a quiet lie about the
 * shape it exists to show.
 */
function spreadOf(
  visitors: Map<string, { correct: number; scored: number }>,
): AccuracySpread {
  const percents = [...visitors.values()]
    .filter((v) => v.scored >= MIN_SCORED_PER_VISITOR)
    .map((v) => (v.correct / v.scored) * 100)
    .sort((x, y) => x - y)

  const buckets: AccuracyBucket[] = []
  for (let min = 0; min < 100; min += ACCURACY_BUCKET_WIDTH) {
    const max = min + ACCURACY_BUCKET_WIDTH
    buckets.push({
      minPercent: min,
      maxPercent: max,
      visitors: percents.filter((p) => p >= min && (p < max || max >= 100))
        .length,
    })
  }

  const mid = Math.floor(percents.length / 2)
  return {
    buckets,
    medianPercent:
      percents.length === 0
        ? 0
        : percents.length % 2 === 1
          ? percents[mid]
          : (percents[mid - 1] + percents[mid]) / 2,
    visitors: percents.length,
  }
}

/** How well a participant's votes matched the durations that actually ran. */
export interface AccuracyScore {
  /** Matchups where they named the animation that really was shorter. */
  correct: number
  /** The denominator — matchups that could be marked at all. */
  scored: number
  /** Matchups excluded because they were called too close to call. */
  ties: number
}

/**
 * How one matchup came out, judged against the durations that actually ran.
 *
 * The two excluded cases stay distinct rather than collapsing into one
 * `'excluded'`, because they are excluded for unrelated reasons and a reader
 * shown the verdict is owed the right one: `called-close` is a judgement the
 * participant made, `no-shorter` is an accident of the roll that left nothing
 * to judge.
 */
export type MatchVerdict = 'correct' | 'wrong' | 'called-close' | 'no-shorter'

/**
 * Judge one matchup.
 *
 * "Too close to call" is `called-close` rather than wrong: the widest gap on
 * offer is 16% of the base either way, close enough to the just-noticeable
 * difference for waits this long that a tie is frequently the honest answer.
 * Marking it would penalise the most defensible vote available.
 *
 * `no-shorter` is a matchup where both animations ran for exactly the same
 * time — there was no shorter one to have picked. Not hypothetical: both sides
 * jitter around a shared base and land on whole milliseconds, so a collision
 * turns up in roughly one run in thirty.
 */
export function matchVerdict(m: MatchInput): MatchVerdict {
  if (m.outcome === 'tie') return 'called-close'
  if (m.durationAMs === m.durationBMs) return 'no-shorter'
  const shorter = m.durationAMs < m.durationBMs ? 'a' : 'b'
  return m.outcome === shorter ? 'correct' : 'wrong'
}

/**
 * Score a run against the durations that actually ran.
 *
 * Both excluded verdicts leave `scored` alone, denominator and all — see
 * `matchVerdict` for why each is excluded. Only `called-close` reaches `ties`:
 * that count exists to back the on-screen note about tie votes, and quietly
 * folding duration collisions into it would make that note a lie.
 *
 * A fold over `matchVerdict` rather than its own copy of the rules, because the
 * results screen now draws a per-matchup strip from the same helper. Two
 * implementations would eventually disagree, and a strip of chips contradicting
 * the score directly above it is worse than either being wrong alone.
 */
export function scoreAccuracy(matches: MatchInput[]): AccuracyScore {
  let correct = 0
  let scored = 0
  let ties = 0

  for (const m of matches) {
    const verdict = matchVerdict(m)
    if (verdict === 'called-close') {
      ties += 1
      continue
    }
    if (verdict === 'no-shorter') continue

    scored += 1
    if (verdict === 'correct') correct += 1
  }

  return { correct, scored, ties }
}

/**
 * All unordered pairs of `items`, each exactly once — a round robin.
 * n items yield n*(n-1)/2 pairs (5 → 10).
 */
export function roundRobinPairs<T>(items: T[]): [T, T][] {
  const pairs: [T, T][] = []
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) pairs.push([items[i], items[j]])
  }
  return pairs
}
