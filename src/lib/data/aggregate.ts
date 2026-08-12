/**
 * Pure aggregation helpers shared by every adapter.
 *
 * Keeping this backend-agnostic means the mock and Supabase adapters compute
 * identical results from a list of raw responses/interactions — the only
 * difference between adapters is *where the rows come from*.
 */
import type {
  EloAggregate,
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
 * Calibration: variants share a 2500ms base with ±200ms of jitter, so the widest
 * gap is 400ms ≈ 16% relative. At 900 points that implies a ~0.70 expected score
 * for the shorter one — roughly twice the just-noticeable difference for waits
 * this long, so clearly perceptible but not a foregone conclusion.
 */
export const DURATION_HANDICAP_FULL = 900

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
 * Matches naming a variant the experiment no longer declares are skipped, so
 * removing a variant degrades gracefully instead of throwing.
 */
export function computeElo(
  experiment: Experiment,
  matches: MatchInput[],
  initialRatings?: Record<string, number>,
): EloAggregate {
  const byId = new Map<string, EloRating>(
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

  let totalMatches = 0

  for (const m of matches) {
    const a = byId.get(m.variantAId)
    const b = byId.get(m.variantBId)
    if (!a || !b || a === b) continue

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
    totalMatches += 1
  }

  const ratings = [...byId.values()].sort(
    (x, y) => y.rating - x.rating || x.label.localeCompare(y.label),
  )

  return { experimentId: experiment.id, totalMatches, ratings }
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
