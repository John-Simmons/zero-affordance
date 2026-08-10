/**
 * Lazily-created Supabase browser client.
 *
 * Only instantiated when both env vars are present. Everything else in the app
 * goes through the `DataProvider` abstraction, so this module has exactly one
 * consumer: `lib/data/supabase.ts`.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { env } from '@/lib/env'

let client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!env.hasSupabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    )
  }
  client ??= createClient(env.supabaseUrl!, env.supabaseAnonKey!, {
    auth: { persistSession: false },
  })
  return client
}
