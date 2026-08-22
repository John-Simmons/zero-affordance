/**
 * Domain model for surveys and experiments.
 *
 * These types are the vocabulary the whole UI speaks. Components and hooks
 * depend on these — never on Supabase rows or any other backend shape. Adapters
 * (mock, supabase, ...) are responsible for mapping their storage to these types.
 *
 * NOTE: this project compiles with `erasableSyntaxOnly`, so we model closed sets
 * as string-literal unions + `const` maps rather than TS `enum`s.
 */

// ---------------------------------------------------------------------------
// Surveys
// ---------------------------------------------------------------------------

export type QuestionType =
  'single_choice' | 'multiple_choice' | 'scale' | 'text'

export interface QuestionOption {
  id: string
  label: string
}

export interface SurveyQuestion {
  id: string
  prompt: string
  type: QuestionType
  helpText?: string
  required?: boolean
  /** For single_choice / multiple_choice. */
  options?: QuestionOption[]
  /** For scale questions (inclusive). Defaults to 1..5. */
  min?: number
  max?: number
  minLabel?: string
  maxLabel?: string
}

export interface Survey {
  id: string
  slug: string
  title: string
  description: string
  questions: SurveyQuestion[]
}

export interface SurveySummary {
  id: string
  slug: string
  title: string
  description: string
  questionCount: number
}

/** A single answer value, shape depends on the question type. */
export type AnswerValue = string | string[] | number

export interface SurveyResponseInput {
  surveyId: string
  visitorId: string
  answers: Record<string, AnswerValue>
}

export interface QuestionAggregate {
  questionId: string
  type: QuestionType
  total: number
  /** choice questions: optionId -> count */
  optionCounts?: Record<string, number>
  /** scale questions: value -> count, plus the mean */
  scaleCounts?: Record<number, number>
  scaleAverage?: number
  /** text questions: a few recent samples */
  textSamples?: string[]
}

export interface SurveyAggregate {
  surveyId: string
  totalResponses: number
  questions: QuestionAggregate[]
}

// ---------------------------------------------------------------------------
// Experiments (A/B-style interactive demos)
// ---------------------------------------------------------------------------

/**
 * How an experiment is played.
 *
 * `rating`   — one variant is assigned per visitor, who rates it on a scale.
 * `pairwise` — the visitor sees every variant, judges them two at a time, and
 *              the results are a global Elo ranking rather than per-variant means.
 */
export type ExperimentKind = 'rating' | 'pairwise'

export const EXPERIMENT_KINDS = {
  rating: 'rating',
  pairwise: 'pairwise',
} as const satisfies Record<ExperimentKind, ExperimentKind>

/**
 * Deliberately carries no duration. A pairwise variant used to declare its own
 * `baseDurationMs`/`jitterMs`, but durations are a property of the *matchup*
 * now — both sides share one base, drawn fresh each time — so nothing about
 * length belongs to a variant's identity. See `rollMatchupDurations` in
 * `aggregate.ts`.
 */
export interface ExperimentVariant {
  id: string
  label: string
  description: string
}

export interface Experiment {
  id: string
  slug: string
  title: string
  description: string
  hypothesis: string
  kind: ExperimentKind
  /** Label of the outcome metric users rate, e.g. "Perceived ease (1–5)". */
  metricLabel: string
  metricMin: number
  metricMax: number
  variants: ExperimentVariant[]
}

export interface ExperimentSummary {
  id: string
  slug: string
  title: string
  description: string
  variantCount: number
}

export interface InteractionInput {
  experimentId: string
  variantId: string
  visitorId: string
  /** The metric value the participant reported (metricMin..metricMax). */
  value: number
}

export interface VariantAggregate {
  variantId: string
  label: string
  count: number
  average: number
  distribution: Record<number, number>
}

export interface ExperimentAggregate {
  experimentId: string
  totalInteractions: number
  variants: VariantAggregate[]
}

// ---------------------------------------------------------------------------
// Pairwise experiments (head-to-head matchups → global Elo ranking)
// ---------------------------------------------------------------------------

/** Which side the participant judged the winner. `tie` is a genuine draw. */
export type MatchOutcome = 'a' | 'b' | 'tie'

export const MATCH_OUTCOMES = {
  a: 'a',
  b: 'b',
  tie: 'tie',
} as const satisfies Record<MatchOutcome, MatchOutcome>

/**
 * One head-to-head judgement.
 *
 * Modelled as A/B + outcome rather than winner/loser because a tie has no
 * winner to name. Both durations are recorded on the row rather than looked up
 * from the variant definition, so retuning a variant's timing later cannot
 * retroactively rewrite match history.
 */
export interface MatchInput {
  experimentId: string
  visitorId: string
  variantAId: string
  variantBId: string
  durationAMs: number
  durationBMs: number
  outcome: MatchOutcome
  /**
   * Whether this matchup was replayed before the vote was cast.
   *
   * Analysis only — nothing in `computeElo` reads it. It is here because a
   * judgement made on a second viewing is a different kind of observation from
   * one made on a first, and that distinction is unrecoverable after the fact:
   * matches are append-only, so a run that did not record it cannot be
   * re-annotated later.
   *
   * A boolean rather than a count because the runner caps redos at one per
   * matchup (`REDOS_PER_MATCHUP`). Raising that cap means widening this to a
   * count, and a migration.
   */
  redone: boolean
}

export interface EloRating {
  variantId: string
  label: string
  rating: number
  matches: number
  wins: number
  losses: number
  ties: number
}

export interface EloAggregate {
  experimentId: string
  totalMatches: number
  /** Sorted by rating, highest first. */
  ratings: EloRating[]
}

/**
 * Every variant's rating at one point along the match replay.
 *
 * `ratings` is a map rather than the row shape a chart wants, so a variant id
 * can never collide with `matchCount`. Flattening is the chart's job.
 */
export interface EloHistoryPoint {
  /** Matches replayed up to and including this point. */
  matchCount: number
  /** Rating per variant id at that point. */
  ratings: Record<string, number>
}

/**
 * The trajectory behind an {@link EloAggregate}.
 *
 * Sampled, not exhaustive: every match is still replayed in order, but only
 * every nth resulting state is kept. The final point is always the state
 * {@link EloAggregate} reports, so the two can never disagree.
 */
export interface EloHistory {
  experimentId: string
  totalMatches: number
  /** Ascending by matchCount. Always opens at 0 and closes at totalMatches. */
  points: EloHistoryPoint[]
}

// ---------------------------------------------------------------------------
// Video ideas
// ---------------------------------------------------------------------------

export interface VideoIdea {
  id: string
  title: string
  description: string
  voteCount: number
  /** Whether the visitor passed to `listVideoIdeas` has upvoted this. */
  votedByVisitor: boolean
  createdAt: string
}

/**
 * Deliberately carries no `visitorId`.
 *
 * An idea is public and must never be traceable to whoever wrote it, and the
 * cheapest way to guarantee that is to give the adapters nothing to write. This
 * is the anonymity promise expressed as a type rather than as a comment.
 */
export interface VideoIdeaInput {
  title: string
  description: string
}

/** What a toggle returns, so the caller can reconcile its optimistic update. */
export interface IdeaVoteResult {
  ideaId: string
  voteCount: number
  voted: boolean
}
