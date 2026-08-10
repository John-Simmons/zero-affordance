/**
 * Mock data provider — persists to localStorage (falls back to memory).
 *
 * This lets the entire app run and accumulate real, evolving data with NO
 * backend configured. It also backs unit tests. It mirrors the semantics of the
 * Supabase adapter so swapping between them is invisible to the UI.
 */
import { aggregateExperiment, aggregateSurvey } from '@/lib/data/aggregate'
import type { DataProvider, Unsubscribe } from '@/lib/data/provider'
import { seedExperiments, seedSurveys } from '@/lib/data/seed'
import type {
  Experiment,
  ExperimentSummary,
  ExperimentVariant,
  InteractionInput,
  Survey,
  SurveySummary,
} from '@/lib/data/types'
import { hashString } from '@/lib/visitor'

const RESPONSES_KEY = 'za.mock.surveyResponses'
const INTERACTIONS_KEY = 'za.mock.interactions'

type Listener = () => void

// In-memory fallback for non-browser environments (SSR / tests without jsdom).
const memory: Record<string, unknown[]> = {}
const listeners: Record<string, Set<Listener>> = {}

function readArray<T>(key: string): T[] {
  if (typeof localStorage === 'undefined') return (memory[key] as T[]) ?? []
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}

function writeArray<T>(key: string, value: T[]): void {
  if (typeof localStorage === 'undefined') memory[key] = value
  else localStorage.setItem(key, JSON.stringify(value))
  listeners[key]?.forEach((fn) => fn())
}

function subscribe(key: string, fn: Listener): Unsubscribe {
  ;(listeners[key] ??= new Set()).add(fn)
  return () => listeners[key]?.delete(fn)
}

// --- Synthetic baseline so first-time visitors see a populated chart --------
// Expressed as counts, then expanded into single-answer synthetic responses so
// the shared aggregator treats them exactly like real data.
const baselineChoice: Record<string, Record<string, number>> = {
  q_notifications: { calm: 14, neutral: 9, anxious: 22, overwhelmed: 7 },
  q_friction: { cookie: 31, unsub: 18, cancel: 12, popup: 24, password: 20 },
}
const baselineScale: Record<string, Record<number, number>> = {
  q_ease: { 1: 6, 2: 13, 3: 20, 4: 9, 5: 4 },
}
const baselineExperiment: Record<string, Record<number, number>> = {
  solid: { 1: 1, 2: 2, 3: 6, 4: 15, 5: 21 },
  flat: { 1: 9, 2: 14, 3: 11, 4: 4, 5: 2 },
}

function baselineSurveyResponses(survey: Survey) {
  const rows: {
    surveyId: string
    visitorId: string
    answers: Record<string, string | number>
  }[] = []
  const push = (questionId: string, value: string | number, n: number) => {
    for (let i = 0; i < n; i++) {
      rows.push({
        surveyId: survey.id,
        visitorId: 'seed',
        answers: { [questionId]: value },
      })
    }
  }
  for (const [qid, counts] of Object.entries(baselineChoice)) {
    for (const [optId, n] of Object.entries(counts)) push(qid, optId, n)
  }
  for (const [qid, counts] of Object.entries(baselineScale)) {
    for (const [val, n] of Object.entries(counts)) push(qid, Number(val), n)
  }
  return rows
}

function baselineInteractions(experiment: Experiment): InteractionInput[] {
  const rows: InteractionInput[] = []
  for (const [variantId, dist] of Object.entries(baselineExperiment)) {
    for (const [val, n] of Object.entries(dist)) {
      for (let i = 0; i < n; i++) {
        rows.push({
          experimentId: experiment.id,
          variantId,
          visitorId: 'seed',
          value: Number(val),
        })
      }
    }
  }
  return rows
}

const summarizeSurvey = (s: Survey): SurveySummary => ({
  id: s.id,
  slug: s.slug,
  title: s.title,
  description: s.description,
  questionCount: s.questions.length,
})

const summarizeExperiment = (e: Experiment): ExperimentSummary => ({
  id: e.id,
  slug: e.slug,
  title: e.title,
  description: e.description,
  variantCount: e.variants.length,
})

export function createMockProvider(): DataProvider {
  const surveys = seedSurveys
  const experiments = seedExperiments

  const findSurvey = (idOrSlug: string) =>
    surveys.find((s) => s.slug === idOrSlug || s.id === idOrSlug) ?? null
  const findExperiment = (idOrSlug: string) =>
    experiments.find((e) => e.slug === idOrSlug || e.id === idOrSlug) ?? null

  return {
    async listSurveys() {
      return surveys.map(summarizeSurvey)
    },

    async getSurvey(slug) {
      return findSurvey(slug)
    },

    async submitSurveyResponse(input) {
      const all = readArray<typeof input & { submittedAt: string }>(
        RESPONSES_KEY,
      )
      all.push({ ...input, submittedAt: new Date().toISOString() })
      writeArray(RESPONSES_KEY, all)
    },

    async getSurveyAggregate(surveyId) {
      const survey = findSurvey(surveyId)
      if (!survey) return { surveyId, totalResponses: 0, questions: [] }
      const stored = readArray<{
        surveyId: string
        visitorId: string
        answers: Record<string, string | string[] | number>
      }>(RESPONSES_KEY).filter((r) => r.surveyId === survey.id)
      return aggregateSurvey(survey, [
        ...baselineSurveyResponses(survey),
        ...stored,
      ])
    },

    async listExperiments() {
      return experiments.map(summarizeExperiment)
    },

    async getExperiment(slug) {
      return findExperiment(slug)
    },

    async assignVariant(experimentId, visitorId): Promise<ExperimentVariant> {
      const exp = findExperiment(experimentId)
      if (!exp) throw new Error(`Unknown experiment: ${experimentId}`)
      const idx = hashString(`${visitorId}:${exp.id}`) % exp.variants.length
      return exp.variants[idx]
    },

    async recordInteraction(input) {
      const all = readArray<typeof input & { createdAt: string }>(
        INTERACTIONS_KEY,
      )
      all.push({ ...input, createdAt: new Date().toISOString() })
      writeArray(INTERACTIONS_KEY, all)
    },

    async getExperimentAggregate(experimentId) {
      const exp = findExperiment(experimentId)
      if (!exp) return { experimentId, totalInteractions: 0, variants: [] }
      const stored = readArray<InteractionInput>(INTERACTIONS_KEY).filter(
        (i) => i.experimentId === exp.id,
      )
      return aggregateExperiment(exp, [...baselineInteractions(exp), ...stored])
    },

    subscribeToSurveyAggregate(_surveyId, onChange) {
      return subscribe(RESPONSES_KEY, onChange)
    },

    subscribeToExperimentAggregate(_experimentId, onChange) {
      return subscribe(INTERACTIONS_KEY, onChange)
    },
  }
}
