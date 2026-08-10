/**
 * Data-provider selection.
 *
 * The rest of the app imports `getDataProvider()` (or the hooks in `hooks.ts`)
 * and never the concrete adapters. Which backend is used is decided here, once,
 * from the environment: Supabase when configured, otherwise the local mock.
 */
import { createMockProvider } from '@/lib/data/mock'
import type { DataProvider } from '@/lib/data/provider'
import { createSupabaseProvider } from '@/lib/data/supabase'
import { env } from '@/lib/env'

/** Human-readable label for the active backend (shown subtly in the footer). */
export const DATA_SOURCE_LABEL = env.hasSupabase ? 'Supabase' : 'Local (mock)'

let provider: DataProvider | null = null

export function getDataProvider(): DataProvider {
  if (provider) return provider
  // The Supabase client is only instantiated when its methods are first called
  // (see lib/supabase/client.ts), so constructing this factory is cheap and
  // safe even before any credentials exist.
  provider = env.hasSupabase ? createSupabaseProvider() : createMockProvider()
  return provider
}

/** Test seam: force a specific provider (used by unit tests). */
export function __setDataProvider(p: DataProvider | null): void {
  provider = p
}
