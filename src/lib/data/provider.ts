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

  // Video ideas
  /** Ordered by votes, then newest. `visitorId` only resolves `votedByVisitor`. */
  listVideoIdeas(visitorId: string): Promise<VideoIdea[]>
  /** Validates and trims via `normalizeIdea`; throws on anything out of bounds. */
  createVideoIdea(input: VideoIdeaInput): Promise<VideoIdea>
  /** Adds or removes this visitor's single vote, and reports the new state. */
  toggleIdeaVote(ideaId: string, visitorId: string): Promise<IdeaVoteResult>

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
