/**
 * React Query hooks — the primary way UI reads/writes data.
 *
 * Components import these, not the provider directly. Each hook delegates to
 * `getDataProvider()`, so the whole app is backend-agnostic and gets caching,
 * loading/error states, and mutation invalidation for free.
 */
import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getDataProvider } from '@/lib/data'
import type {
  InteractionInput,
  MatchInput,
  SurveyResponseInput,
} from '@/lib/data/types'

export const queryKeys = {
  surveys: ['surveys'] as const,
  survey: (slug: string) => ['survey', slug] as const,
  surveyAggregate: (surveyId: string) =>
    ['survey-aggregate', surveyId] as const,
  experiments: ['experiments'] as const,
  experiment: (slug: string) => ['experiment', slug] as const,
  variant: (experimentId: string, visitorId: string) =>
    ['variant', experimentId, visitorId] as const,
  experimentAggregate: (experimentId: string) =>
    ['experiment-aggregate', experimentId] as const,
  eloAggregate: (experimentId: string) =>
    ['elo-aggregate', experimentId] as const,
}

// --- Surveys ---------------------------------------------------------------

export function useSurveys() {
  return useQuery({
    queryKey: queryKeys.surveys,
    queryFn: () => getDataProvider().listSurveys(),
  })
}

export function useSurvey(slug: string) {
  return useQuery({
    queryKey: queryKeys.survey(slug),
    queryFn: () => getDataProvider().getSurvey(slug),
  })
}

export function useSurveyAggregate(surveyId: string | undefined) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.surveyAggregate(surveyId ?? ''),
    queryFn: () => getDataProvider().getSurveyAggregate(surveyId!),
    enabled: Boolean(surveyId),
  })

  // Best-effort realtime: refetch when the backend signals a change.
  useEffect(() => {
    if (!surveyId) return
    const provider = getDataProvider()
    const unsub = provider.subscribeToSurveyAggregate?.(surveyId, () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.surveyAggregate(surveyId),
      })
    })
    return unsub
  }, [surveyId, queryClient])

  return query
}

export function useSubmitSurveyResponse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SurveyResponseInput) =>
      getDataProvider().submitSurveyResponse(input),
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.surveyAggregate(input.surveyId),
      })
    },
  })
}

// --- Experiments -----------------------------------------------------------

export function useExperiments() {
  return useQuery({
    queryKey: queryKeys.experiments,
    queryFn: () => getDataProvider().listExperiments(),
  })
}

export function useExperiment(slug: string) {
  return useQuery({
    queryKey: queryKeys.experiment(slug),
    queryFn: () => getDataProvider().getExperiment(slug),
  })
}

export function useAssignedVariant(
  experimentId: string | undefined,
  visitorId: string,
) {
  return useQuery({
    queryKey: queryKeys.variant(experimentId ?? '', visitorId),
    queryFn: () => getDataProvider().assignVariant(experimentId!, visitorId),
    enabled: Boolean(experimentId),
    staleTime: Infinity, // assignment is deterministic and stable
  })
}

export function useExperimentAggregate(experimentId: string | undefined) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.experimentAggregate(experimentId ?? ''),
    queryFn: () => getDataProvider().getExperimentAggregate(experimentId!),
    enabled: Boolean(experimentId),
  })

  useEffect(() => {
    if (!experimentId) return
    const provider = getDataProvider()
    const unsub = provider.subscribeToExperimentAggregate?.(
      experimentId,
      () => {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.experimentAggregate(experimentId),
        })
      },
    )
    return unsub
  }, [experimentId, queryClient])

  return query
}

export function useRecordInteraction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: InteractionInput) =>
      getDataProvider().recordInteraction(input),
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.experimentAggregate(input.experimentId),
      })
    },
  })
}

// --- Pairwise experiments --------------------------------------------------

export function useEloAggregate(experimentId: string | undefined) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.eloAggregate(experimentId ?? ''),
    queryFn: () => getDataProvider().getEloAggregate(experimentId!),
    enabled: Boolean(experimentId),
  })

  useEffect(() => {
    if (!experimentId) return
    const provider = getDataProvider()
    const unsub = provider.subscribeToEloAggregate?.(experimentId, () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.eloAggregate(experimentId),
      })
    })
    return unsub
  }, [experimentId, queryClient])

  return query
}

export function useRecordMatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: MatchInput) => getDataProvider().recordMatch(input),
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.eloAggregate(input.experimentId),
      })
    },
  })
}
