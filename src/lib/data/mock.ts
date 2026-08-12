/**
 * Mock data provider — persists to localStorage (falls back to memory).
 *
 * This lets the entire app run and accumulate real, evolving data with NO
 * backend configured. It also backs unit tests. It mirrors the semantics of the
 * Supabase adapter so swapping between them is invisible to the UI.
 */
import {
  aggregateExperiment,
  aggregateSurvey,
  computeElo,
  roundRobinPairs,
} from '@/lib/data/aggregate'
import type { DataProvider, Unsubscribe } from '@/lib/data/provider'
import { seedExperiments, seedSurveys } from '@/lib/data/seed'
import type {
  Experiment,
  ExperimentSummary,
  ExperimentVariant,
  InteractionInput,
  MatchInput,
  MatchOutcome,
  Survey,
  SurveySummary,
} from '@/lib/data/types'
import { hashString } from '@/lib/visitor'

const RESPONSES_KEY = 'za.mock.surveyResponses'
const INTERACTIONS_KEY = 'za.mock.interactions'
const MATCHES_KEY = 'za.mock.matches'

/** Stored match rows carry ordering metadata the domain type doesn't need. */
type StoredMatch = MatchInput & { createdAt: string; seq: number }

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

// Baseline for the pairwise experiment. Elo is path-dependent, so this must be
// deterministic — a fresh random draw on every read would make the leaderboard
// jump around between renders. Seeded PRNG, fixed seed, same rows every time.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Hidden "feels fast" weighting used ONLY to synthesise a plausible baseline —
 * indicators conveying definite progress tend to read as quicker. Real votes
 * overwrite this influence as they accumulate.
 */
const baselineAppeal: Record<string, number> = {
  progress_bar: 0.8,
  baking: 0.7,
  skeleton: 0.6,
  quote: 0.45,
  classic_spinner: 0.3,
  blank: 0.15,
}

const BASELINE_RUNS = 12

function rollDuration(v: ExperimentVariant, rand: () => number): number {
  const base = v.baseDurationMs ?? 1500
  const jitter = v.jitterMs ?? 0
  return Math.round(base + (rand() * 2 - 1) * jitter)
}

function baselineMatches(experiment: Experiment): MatchInput[] {
  if (experiment.kind !== 'pairwise') return []
  const rand = mulberry32(hashString(`baseline:${experiment.id}`))
  const rows: MatchInput[] = []
  for (let run = 0; run < BASELINE_RUNS; run++) {
    for (const [a, b] of roundRobinPairs(experiment.variants)) {
      const durationAMs = rollDuration(a, rand)
      const durationBMs = rollDuration(b, rand)
      // Longer runs feel slower; appeal stands in for everything else.
      const scoreA = (baselineAppeal[a.id] ?? 0.5) - durationAMs / 6000
      const scoreB = (baselineAppeal[b.id] ?? 0.5) - durationBMs / 6000
      const margin = scoreA - scoreB + (rand() - 0.5) * 0.35
      const outcome: MatchOutcome =
        margin > 0.06 ? 'a' : margin < -0.06 ? 'b' : 'tie'
      rows.push({
        experimentId: experiment.id,
        visitorId: 'seed',
        variantAId: a.id,
        variantBId: b.id,
        durationAMs,
        durationBMs,
        outcome,
      })
    }
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

    async recordMatch(input) {
      const all = readArray<StoredMatch>(MATCHES_KEY)
      // `seq` breaks ties when several votes land in the same millisecond —
      // a real risk here, since one run submits ten matches in a few minutes.
      all.push({
        ...input,
        createdAt: new Date().toISOString(),
        seq: all.length,
      })
      writeArray(MATCHES_KEY, all)
    },

    async getEloAggregate(experimentId) {
      const exp = findExperiment(experimentId)
      if (!exp) return { experimentId, totalMatches: 0, ratings: [] }
      const stored = readArray<StoredMatch>(MATCHES_KEY)
        .filter((m) => m.experimentId === exp.id)
        .sort((x, y) => x.createdAt.localeCompare(y.createdAt) || x.seq - y.seq)
      // Baseline first: it stands in for history that predates this visitor.
      return computeElo(exp, [...baselineMatches(exp), ...stored])
    },

    subscribeToSurveyAggregate(_surveyId, onChange) {
      return subscribe(RESPONSES_KEY, onChange)
    },

    subscribeToExperimentAggregate(_experimentId, onChange) {
      return subscribe(INTERACTIONS_KEY, onChange)
    },

    subscribeToEloAggregate(_experimentId, onChange) {
      return subscribe(MATCHES_KEY, onChange)
    },
  }
}
