/**
 * The data-access contract.
 *
 * This is the single seam between the UI and whatever stores the data. Today it
 * is implemented by `mock.ts` (localStorage) and `supabase.ts`. To move to a
 * different backend later, write one new file that satisfies this interface —
 * components and hooks never change.
 */
import type {
  Experiment,
  ExperimentAggregate,
  ExperimentSummary,
  ExperimentVariant,
  InteractionInput,
  Survey,
  SurveyAggregate,
  SurveyResponseInput,
  SurveySummary,
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
}
