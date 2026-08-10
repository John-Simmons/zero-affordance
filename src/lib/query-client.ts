import { QueryClient } from '@tanstack/react-query'

/**
 * Shared React Query client. Conservative defaults tuned for a content/companion
 * site: data is fresh briefly, retries are limited, and we don't refetch on
 * every window focus (surveys/experiments update via explicit invalidation and
 * realtime subscriptions instead).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
