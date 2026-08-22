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
  ExperimentAggregate,
  InteractionInput,
  MatchInput,
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
export function computeElo(
  experiment: Experiment,
  matches: MatchInput[],
  initialRatings?: Record<string, number>,
): EloAggregate {
  const byId = startingRatings(experiment, initialRatings)

  let totalMatches = 0
  for (const m of matches) {
    if (applyMatch(byId, m)) totalMatches += 1
  }

  const ratings = [...byId.values()].sort(
    (x, y) => y.rating - x.rating || x.label.localeCompare(y.label),
  )

  return { experimentId: experiment.id, totalMatches, ratings }
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
