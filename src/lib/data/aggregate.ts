/**
 * Pure aggregation helpers shared by every adapter.
 *
 * Keeping this backend-agnostic means the mock and Supabase adapters compute
 * identical results from a list of raw responses/interactions — the only
 * difference between adapters is *where the rows come from*.
 */
import type {
  Experiment,
  ExperimentAggregate,
  InteractionInput,
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
