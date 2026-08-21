/**
 * The data-access contract.
 *
 * This is the single seam between the UI and whatever stores the data. Today it
 * is implemented by `mock.ts` (localStorage) and `supabase.ts`. To move to a
 * different backend later, write one new file that satisfies this interface —
 * components and hooks never change.
 */
import type {
  EloAggregate,
  EloHistory,
  Experiment,
  ExperimentAggregate,
  ExperimentSummary,
  ExperimentVariant,
  InteractionInput,
  MatchInput,
  IdeaVoteResult,
  Survey,
  SurveyAggregate,
  SurveyResponseInput,
  SurveySummary,
  VideoIdea,
  VideoIdeaInput,
} from '@/lib/data/types'

/** Called when an aggregate changes (realtime). Returns an unsubscribe fn. */
export type Unsubscribe = () => void

export interface DataProvider {
  // Surveys
  listSurveys(): Promise<SurveySummary[]>
  getSurvey(slug: string): Promise<Survey | null>
  submitSurveyResponse(input: SurveyResponseInput): Promise<void>
  getSurveyAggregate(surveyId: string): Promise<SurveyAggregate>

  // Experiments
  listExperiments(): Promise<ExperimentSummary[]>
  getExperiment(slug: string): Promise<Experiment | null>
  /** Deterministically assign the visitor to a variant. */
  assignVariant(
    experimentId: string,
    visitorId: string,
  ): Promise<ExperimentVariant>
  recordInteraction(input: InteractionInput): Promise<void>
  getExperimentAggregate(experimentId: string): Promise<ExperimentAggregate>

  // Pairwise experiments
  /** Append one head-to-head judgement. Rows are immutable. */
  recordMatch(input: MatchInput): Promise<void>
  /** Derive current Elo ratings by replaying every recorded match. */
  getEloAggregate(experimentId: string): Promise<EloAggregate>
  /**
   * Ratings sampled along that same replay, for showing how they got there.
   *
   * Must read the same ordered matches `getEloAggregate` does — its last point
   * is that method's answer, and a chart contradicting the table beside it is
   * worse than no chart.
   */
  getEloHistory(experimentId: string): Promise<EloHistory>

  // Video ideas
  /** Ordered by votes, then newest. `visitorId` only resolves `votedByVisitor`. */
  listVideoIdeas(visitorId: string): Promise<VideoIdea[]>
  /** Validates and trims via `normalizeIdea`; throws on anything out of bounds. */
  createVideoIdea(input: VideoIdeaInput): Promise<VideoIdea>
  /**
   * Sets this visitor's single vote to `voted`, and reports the new state.
   *
   * Deliberately a set rather than a toggle: a toggle's outcome depends on how
   * many times the call arrives, so one duplicated request silently undoes the
   * vote. Calling this twice with the same `voted` is a no-op.
   */
  setIdeaVote(
    ideaId: string,
    visitorId: string,
    voted: boolean,
  ): Promise<IdeaVoteResult>

  /**
   * Optional realtime hook. Adapters that cannot stream may omit it; callers
   * must treat it as best-effort and fall back to refetching.
   */
  subscribeToSurveyAggregate?(
    surveyId: string,
    onChange: () => void,
  ): Unsubscribe
  subscribeToExperimentAggregate?(
    experimentId: string,
    onChange: () => void,
  ): Unsubscribe
  subscribeToEloAggregate?(
    experimentId: string,
    onChange: () => void,
  ): Unsubscribe
  /** Fires for new ideas, vote changes, and moderation removals alike. */
  subscribeToVideoIdeas?(onChange: () => void): Unsubscribe
}
