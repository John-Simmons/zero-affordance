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
