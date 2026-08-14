/**
 * Supabase data provider.
 *
 * Implements the exact same `DataProvider` contract as the mock. It maps DB rows
 * to domain types and reuses the shared pure aggregators, so behaviour matches
 * the mock adapter.
 *
 * Scaffolding note: aggregates are currently computed client-side from the base
 * rows (simple + correct for modest volumes). When traffic grows, move the
 * aggregation into Postgres views/RPC and point these methods at them — the UI
 * won't need to change because the return types are unchanged.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  aggregateExperiment,
  aggregateSurvey,
  computeElo,
} from '@/lib/data/aggregate'
import type { DataProvider, Unsubscribe } from '@/lib/data/provider'
import type {
  AnswerValue,
  Experiment,
  ExperimentKind,
  ExperimentVariant,
  InteractionInput,
  MatchInput,
  MatchOutcome,
  Survey,
  SurveyQuestion,
  SurveyResponseInput,
} from '@/lib/data/types'
import { getSupabaseClient } from '@/lib/supabase/client'
import { hashString } from '@/lib/visitor'

interface SurveyRow {
  id: string
  slug: string
  title: string
  description: string
}
interface QuestionRow {
  id: string
  prompt: string
  type: SurveyQuestion['type']
  help_text: string | null
  required: boolean | null
  min: number | null
  max: number | null
  min_label: string | null
  max_label: string | null
  options: { id: string; label: string }[] | null
}
interface ExperimentRow {
  id: string
  slug: string
  title: string
  description: string
  hypothesis: string
  kind: ExperimentKind | null
  metric_label: string
  metric_min: number
  metric_max: number
}
interface VariantRow {
  id: string
  label: string
  description: string
}
interface MatchRow {
  variant_a_id: string
  variant_b_id: string
  duration_a_ms: number
  duration_b_ms: number
  outcome: MatchOutcome
}

function mapQuestion(row: QuestionRow): SurveyQuestion {
  return {
    id: row.id,
    prompt: row.prompt,
    type: row.type,
    helpText: row.help_text ?? undefined,
    required: row.required ?? undefined,
    options: row.options ?? undefined,
    min: row.min ?? undefined,
    max: row.max ?? undefined,
    minLabel: row.min_label ?? undefined,
    maxLabel: row.max_label ?? undefined,
  }
}

export function createSupabaseProvider(
  client: SupabaseClient = getSupabaseClient(),
): DataProvider {
  async function loadSurvey(idOrSlug: string): Promise<Survey | null> {
    const { data: survey, error } = await client
      .from('surveys')
      .select('id, slug, title, description')
      .or(`slug.eq.${idOrSlug},id.eq.${idOrSlug}`)
      .maybeSingle<SurveyRow>()
    if (error) throw error
    if (!survey) return null

    const { data: questions, error: qErr } = await client
      .from('survey_questions')
      .select(
        'id, prompt, type, help_text, required, min, max, min_label, max_label, options',
      )
      .eq('survey_id', survey.id)
      .order('position', { ascending: true })
      .returns<QuestionRow[]>()
    if (qErr) throw qErr

    return { ...survey, questions: (questions ?? []).map(mapQuestion) }
  }

  async function loadExperiment(idOrSlug: string): Promise<Experiment | null> {
    const { data: exp, error } = await client
      .from('experiments')
      .select(
        'id, slug, title, description, hypothesis, kind, metric_label, metric_min, metric_max',
      )
      .or(`slug.eq.${idOrSlug},id.eq.${idOrSlug}`)
      .maybeSingle<ExperimentRow>()
    if (error) throw error
    if (!exp) return null

    const { data: variants, error: vErr } = await client
      .from('experiment_variants')
      .select('id, label, description')
      .eq('experiment_id', exp.id)
      .order('position', { ascending: true })
      .returns<VariantRow[]>()
    if (vErr) throw vErr

    return {
      id: exp.id,
      slug: exp.slug,
      title: exp.title,
      description: exp.description,
      hypothesis: exp.hypothesis,
      kind: exp.kind ?? 'rating',
      metricLabel: exp.metric_label,
      metricMin: exp.metric_min,
      metricMax: exp.metric_max,
      variants: (variants ?? []).map((v) => ({
        id: v.id,
        label: v.label,
        description: v.description,
      })),
    }
  }

  return {
    async listSurveys() {
      const { data, error } = await client
        .from('surveys')
        .select('id, slug, title, description, survey_questions(count)')
        .order('position', { ascending: true })
      if (error) throw error
      return (data ?? []).map((s: Record<string, unknown>) => ({
        id: s.id as string,
        slug: s.slug as string,
        title: s.title as string,
        description: s.description as string,
        questionCount:
          (s.survey_questions as { count: number }[] | undefined)?.[0]?.count ??
          0,
      }))
    },

    getSurvey: loadSurvey,

    async submitSurveyResponse(input: SurveyResponseInput) {
      const { error } = await client.from('survey_responses').insert({
        survey_id: input.surveyId,
        visitor_id: input.visitorId,
        answers: input.answers,
      })
      if (error) throw error
    },

    async getSurveyAggregate(surveyId: string) {
      const survey = await loadSurvey(surveyId)
      if (!survey) return { surveyId, totalResponses: 0, questions: [] }
      const { data, error } = await client
        .from('survey_responses')
        .select('answers')
        .eq('survey_id', survey.id)
        .returns<{ answers: Record<string, AnswerValue> }[]>()
      if (error) throw error
      const responses = (data ?? []).map((r) => ({
        surveyId: survey.id,
        visitorId: '',
        answers: r.answers,
      }))
      return aggregateSurvey(survey, responses)
    },

    async listExperiments() {
      const { data, error } = await client
        .from('experiments')
        .select('id, slug, title, description, experiment_variants(count)')
        .order('position', { ascending: true })
      if (error) throw error
      return (data ?? []).map((e: Record<string, unknown>) => ({
        id: e.id as string,
        slug: e.slug as string,
        title: e.title as string,
        description: e.description as string,
        variantCount:
          (e.experiment_variants as { count: number }[] | undefined)?.[0]
            ?.count ?? 0,
      }))
    },

    getExperiment: loadExperiment,

    async assignVariant(
      experimentId: string,
      visitorId: string,
    ): Promise<ExperimentVariant> {
      const exp = await loadExperiment(experimentId)
      if (!exp) throw new Error(`Unknown experiment: ${experimentId}`)
      const idx = hashString(`${visitorId}:${exp.id}`) % exp.variants.length
      return exp.variants[idx]
    },

    async recordInteraction(input: InteractionInput) {
      const { error } = await client.from('experiment_interactions').insert({
        experiment_id: input.experimentId,
        variant_id: input.variantId,
        visitor_id: input.visitorId,
        value: input.value,
      })
      if (error) throw error
    },

    async getExperimentAggregate(experimentId: string) {
      const exp = await loadExperiment(experimentId)
      if (!exp) return { experimentId, totalInteractions: 0, variants: [] }
      const { data, error } = await client
        .from('experiment_interactions')
        .select('variant_id, value')
        .eq('experiment_id', exp.id)
        .returns<{ variant_id: string; value: number }[]>()
      if (error) throw error
      const interactions: InteractionInput[] = (data ?? []).map((i) => ({
        experimentId: exp.id,
        variantId: i.variant_id,
        visitorId: '',
        value: i.value,
      }))
      return aggregateExperiment(exp, interactions)
    },

    async recordMatch(input: MatchInput) {
      const { error } = await client.from('experiment_matches').insert({
        experiment_id: input.experimentId,
        visitor_id: input.visitorId,
        variant_a_id: input.variantAId,
        variant_b_id: input.variantBId,
        duration_a_ms: input.durationAMs,
        duration_b_ms: input.durationBMs,
        outcome: input.outcome,
      })
      if (error) throw error
    },

    async getEloAggregate(experimentId: string) {
      const exp = await loadExperiment(experimentId)
      if (!exp) return { experimentId, totalMatches: 0, ratings: [] }
      const { data, error } = await client
        .from('experiment_matches')
        .select(
          'variant_a_id, variant_b_id, duration_a_ms, duration_b_ms, outcome',
        )
        .eq('experiment_id', exp.id)
        // Load-bearing, not cosmetic: Elo is path-dependent, so an unordered
        // read would yield different ratings from the same rows. `id` breaks
        // ties within a millisecond.
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .returns<MatchRow[]>()
      if (error) throw error
      const matches: MatchInput[] = (data ?? []).map((m) => ({
        experimentId: exp.id,
        visitorId: '',
        variantAId: m.variant_a_id,
        variantBId: m.variant_b_id,
        durationAMs: m.duration_a_ms,
        durationBMs: m.duration_b_ms,
        outcome: m.outcome,
      }))
      return computeElo(exp, matches)
    },

    subscribeToSurveyAggregate(surveyId: string, onChange): Unsubscribe {
      const channel = client
        .channel(`survey_responses:${surveyId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'survey_responses',
            filter: `survey_id=eq.${surveyId}`,
          },
          () => onChange(),
        )
        .subscribe()
      return () => {
        void client.removeChannel(channel)
      }
    },

    subscribeToExperimentAggregate(
      experimentId: string,
      onChange,
    ): Unsubscribe {
      const channel = client
        .channel(`experiment_interactions:${experimentId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'experiment_interactions',
            filter: `experiment_id=eq.${experimentId}`,
          },
          () => onChange(),
        )
        .subscribe()
      return () => {
        void client.removeChannel(channel)
      }
    },

    subscribeToEloAggregate(experimentId: string, onChange): Unsubscribe {
      const channel = client
        .channel(`experiment_matches:${experimentId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'experiment_matches',
            filter: `experiment_id=eq.${experimentId}`,
          },
          () => onChange(),
        )
        .subscribe()
      return () => {
        void client.removeChannel(channel)
      }
    },
  }
}
