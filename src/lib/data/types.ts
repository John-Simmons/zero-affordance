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
  /**
   * Distinct visitors behind `totalMatches`.
   *
   * Counted over the same matches the ratings were built from, so the two
   * numbers always describe one dataset — a participant whose every match was
   * skipped is not one of these.
   */
  totalParticipants: number
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

/**
 * How far behind on the clock one variant can be and still take the vote.
 *
 * Both gaps describe the same wins: `meanGapMs` is what the copy shows, because
 * "0.4s longer" is legible in a sentence, and `meanRelativeGap` is the
 * Weber-consistent form the Elo handicap itself uses (see `expectedScore`),
 * kept so the number can be compared across duration bands.
 */
export interface HandicapRecord {
  variantId: string
  label: string
  /** Decisive wins taken while running longer than the opponent. */
  wins: number
  /** Mean (own − opponent) over those wins. Positive: it was slower. */
  meanGapMs: number
  /** The same mean as a fraction of each matchup's mean duration. */
  meanRelativeGap: number
}

/**
 * Votes by the slot the animation played in, not by which animation it was.
 *
 * The runner randomises which variant lands in each slot per matchup, so a skew
 * here is a position effect — primacy or recency — and not a difference between
 * the loading states.
 */
export interface PositionSplit {
  /** Decisive votes for whatever played first. */
  first: number
  /** Decisive votes for whatever played second. */
  second: number
  /** Called too close to call. Excluded from both counts above. */
  ties: number
}

/**
 * How often the shorter animation was picked, at one size of duration gap.
 *
 * Bucketed by RELATIVE gap for the same reason the handicap is relative: what
 * makes a gap noticeable is its size against the wait it sits in, not its size
 * in milliseconds.
 */
export interface GapAccuracyBucket {
  /** Exclusive upper edge, as a fraction. `null` is the open-ended top bucket. */
  maxRelativeGap: number | null
  /** Votes in this bucket that named the shorter animation. */
  correct: number
  /** Votes in this bucket that named either — ties and dead heats excluded. */
  scored: number
}

/**
 * One pairing's record, from A's point of view.
 *
 * Canonical: `aId` is always the lower id of the two, so a pairing has exactly
 * one row however the matchups that fed it were ordered.
 */
export interface PairRecord {
  aId: string
  bId: string
  aWins: number
  bWins: number
  ties: number
}

/**
 * Whether a second viewing changes the judgement.
 *
 * Both halves count only matchups that could be marked at all — a tie names no
 * winner and a dead heat has no shorter side — so the two rates are on the same
 * scale as {@link AccuracyScore} and as each other.
 */
export interface ReplayAccuracy {
  /** Matchups the participant replayed before voting. */
  replayed: { correct: number; scored: number }
  /** Matchups judged on a single viewing. */
  firstView: { correct: number; scored: number }
}

/**
 * How often a loading state appears in a matchup someone had to watch twice.
 *
 * Attributed to BOTH variants in a replayed matchup, because that is what the
 * data supports: a redo replays the whole matchup, so the row records that the
 * pair together was hard to separate, not which half of it was unmemorable.
 * Across many matchups the opponents vary and the rate still points somewhere,
 * but a single row never does.
 */
export interface RedoRecord {
  variantId: string
  label: string
  /** Matchups it appeared in that were replayed before the vote. */
  replayed: number
  /** Every matchup it appeared in. */
  matches: number
}

/**
 * How often one person's own votes cannot all be true at once.
 *
 * A triple is circular when someone said A felt faster than B, B faster than C,
 * and C faster than A. No ranking satisfies all three, so at least one of those
 * votes is noise — which makes this a direct read on how much of the whole
 * experiment is signal.
 *
 * Only triples where that person decided all three pairings count; a tie leaves
 * a pairing undecided, and an undecided pairing cannot contradict anything.
 */
export interface ContradictionStats {
  /** Triples that came out circular. */
  cyclic: number
  /** Triples where all three pairings were decided by the same person. */
  triples: number
  visitorsWithCycle: number
  /** Visitors who decided all three pairings of at least one triple. */
  visitorsScored: number
}

/** How many people scored within one band. */
export interface AccuracyBucket {
  /** Inclusive lower edge, in percent. */
  minPercent: number
  /** Exclusive upper edge, except on the top band, which includes 100. */
  maxPercent: number
  visitors: number
}

/**
 * The distribution of individual scores, rather than one average of them.
 *
 * A mean answers "can people do this" with a number nobody scored. The shape
 * answers something better: one hump near chance means everybody is guessing,
 * two humps mean some people genuinely read duration and others do not.
 */
export interface AccuracySpread {
  /** Ascending, and contiguous — every band is present even when empty. */
  buckets: AccuracyBucket[]
  /** The middle score; a skewed distribution makes this more honest than a mean. */
  medianPercent: number
  /** Visitors with enough marked matchups to place. */
  visitors: number
}

/**
 * Facts about the whole match log that the standings cannot express.
 *
 * `EloAggregate` answers "who is winning" and `EloHistory` answers "since
 * when"; this answers the questions that need the individual matchups back —
 * who wins from behind, how much of a head start people can absorb before they
 * notice, whether the slot an animation played in matters more than what it
 * was. Nothing here is derivable from the other two shapes.
 *
 * Deliberately computed adapter-side from one pure function rather than shipped
 * to the client as raw rows: the corpus grows without bound and every question
 * asked of it here is a fold.
 */
export interface MatchInsights {
  experimentId: string
  /**
   * Matches these findings were built from.
   *
   * The same definition {@link EloAggregate} uses — matches naming a variant
   * the experiment no longer declares are skipped by both — so the two numbers
   * can be printed side by side.
   */
  totalMatches: number
  /** Every declared variant, largest gap overcome first. */
  handicaps: HandicapRecord[]
  positionSplit: PositionSplit
  /** Ascending by gap size; the last bucket is open-ended. */
  gapAccuracy: GapAccuracyBucket[]
  /** Every pairing that has been played at least once. */
  pairRecords: PairRecord[]
  replayAccuracy: ReplayAccuracy
  /** Every declared variant, most replayed first. */
  redos: RedoRecord[]
  contradictions: ContradictionStats
  accuracySpread: AccuracySpread
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
