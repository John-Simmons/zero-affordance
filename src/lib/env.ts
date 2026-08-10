/**
 * Typed access to Vite environment variables.
 *
 * All client-exposed vars must be prefixed with `VITE_` (see `.env.example`).
 * When the Supabase vars are absent we fall back to the in-memory/localStorage
 * mock data provider, so the app runs with zero backend configuration.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const env = {
  supabaseUrl,
  supabaseAnonKey,
  /** True only when both Supabase credentials are present. */
  hasSupabase: Boolean(supabaseUrl && supabaseAnonKey),
} as const
