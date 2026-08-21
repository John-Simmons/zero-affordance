/**
 * React Query hooks — the primary way UI reads/writes data.
 *
 * Components import these, not the provider directly. Each hook delegates to
 * `getDataProvider()`, so the whole app is backend-agnostic and gets caching,
 * loading/error states, and mutation invalidation for free.
 */
import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { getDataProvider } from '@/lib/data'
import type {
  VideoIdea,
  VideoIdeaInput,
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
  eloHistory: (experimentId: string) => ['elo-history', experimentId] as const,
  // Keyed by visitor because `votedByVisitor` is part of the payload — two
  // browsers must not share a cache entry.
  videoIdeas: (visitorId: string) => ['video-ideas', visitorId] as const,
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

/**
 * The trajectory behind {@link useEloAggregate}.
 *
 * Kept as its own query rather than folded into the aggregate: a run invalidates
 * the standings on every one of its fifteen votes, and recomputing a sampled
 * replay that often to redraw a chart nobody is looking at yet is wasted work.
 * It rides the same subscription, since both read one table.
 */
export function useEloHistory(experimentId: string | undefined) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.eloHistory(experimentId ?? ''),
    queryFn: () => getDataProvider().getEloHistory(experimentId!),
    enabled: Boolean(experimentId),
  })

  useEffect(() => {
    if (!experimentId) return
    const provider = getDataProvider()
    const unsub = provider.subscribeToEloAggregate?.(experimentId, () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.eloHistory(experimentId),
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
    // Both derive from the same match log, so both go stale together. Missing
    // the history here would leave the chart a vote behind the table.
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.eloAggregate(input.experimentId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.eloHistory(input.experimentId),
      })
    },
  })
}

export function useVideoIdeas(visitorId: string) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.videoIdeas(visitorId),
    queryFn: () => getDataProvider().listVideoIdeas(visitorId),
  })

  // Best-effort realtime: refetch when the backend signals a change.
  useEffect(() => {
    const unsub = getDataProvider().subscribeToVideoIdeas?.(() => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.videoIdeas(visitorId),
      })
    })
    return unsub
  }, [visitorId, queryClient])

  return query
}

export function useCreateVideoIdea(visitorId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: VideoIdeaInput) =>
      getDataProvider().createVideoIdea(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.videoIdeas(visitorId),
      })
    },
  })
}

/**
 * Optimistic, because a vote is a tap on a counter and waiting a round trip to
 * see it move feels broken. Rolled back on error and reconciled from the
 * server's own count on success, so a failed or raced vote cannot leave the
 * list showing a number the backend disagrees with.
 *
 * Takes the intended state rather than flipping the current one. A rollback and
 * a genuine un-vote look identical on screen, so when the write was a toggle,
 * one duplicated request read to the visitor as "the site took my vote away" —
 * and left the server agreeing with that. `voted` comes from what the visitor
 * could see when they tapped, so a real second tap still un-votes.
 */
export function useSetIdeaVote(visitorId: string) {
  const queryClient = useQueryClient()
  const key = queryKeys.videoIdeas(visitorId)

  return useMutation({
    mutationFn: ({ ideaId, voted }: { ideaId: string; voted: boolean }) =>
      getDataProvider().setIdeaVote(ideaId, visitorId, voted),

    onMutate: async ({ ideaId, voted }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<VideoIdea[]>(key)
      queryClient.setQueryData<VideoIdea[]>(key, (old) =>
        old?.map((i) =>
          i.id === ideaId
            ? {
                ...i,
                votedByVisitor: voted,
                // Only moves when the flag actually changes, so a redundant
                // call cannot drift the count off the row it is counting.
                voteCount:
                  i.votedByVisitor === voted
                    ? i.voteCount
                    : i.voteCount + (voted ? 1 : -1),
              }
            : i,
        ),
      )
      return { previous }
    },

    onError: (err, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
      // Without these the rollback is the only feedback, and a failed write is
      // indistinguishable from the site quietly discarding the vote. The toast
      // is for the visitor; the log carries the PostgREST code, which is the
      // part that says *why* — and which React Query otherwise swallows.
      console.error('setIdeaVote failed', err)
      toast.error('Could not save your vote. Try again in a moment.')
    },

    onSuccess: (result) => {
      queryClient.setQueryData<VideoIdea[]>(key, (old) =>
        old?.map((i) =>
          i.id === result.ideaId
            ? {
                ...i,
                voteCount: result.voteCount,
                votedByVisitor: result.voted,
              }
            : i,
        ),
      )
    },

    // Belt and braces over the write above: if a realtime refetch was already
    // in flight when the vote landed, its older answer can arrive last and win.
    // This guarantees one more read after everything has settled.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key })
    },
  })
}
