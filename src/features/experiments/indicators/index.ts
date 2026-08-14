import type { ReactNode } from 'react'

import { BakingIndicator } from '@/features/experiments/indicators/baking-indicator'
import { BlankIndicator } from '@/features/experiments/indicators/blank-indicator'
import { ClassicSpinner } from '@/features/experiments/indicators/classic-spinner'
import { ProgressBarIndicator } from '@/features/experiments/indicators/progress-bar'
import { QuoteIndicator } from '@/features/experiments/indicators/quote-indicator'
import { SkeletonLoader } from '@/features/experiments/indicators/skeleton-loader'

/**
 * A loading indicator: a pure function of how far through the wait we are, and
 * of which appearance this is.
 *
 * `progress` runs 0 → 1 over the duration this matchup assigned the variant.
 * Indicators must never run on their own clock for anything that implies
 * completion — the Elo handicap corrects for the assigned duration, so an
 * animation that finished early or ran past the end would be measuring
 * something that didn't happen.
 *
 * `seed` is an arbitrary but stable integer identifying one appearance: the
 * same seed must always produce the same output. It exists so an indicator can
 * vary its content between matchups without drawing a random value itself,
 * which would not survive how the runner mounts these — an indicator is mounted
 * TWICE per appearance (the stimulus canvas, then a fresh mount in the
 * vote-time recap at `progress={1}`) and re-rendered every animation frame in
 * between. Anything picked internally would differ between those two mounts and
 * the recap would show something that never played.
 *
 * Ignoring either prop entirely is fine, and in `progress`'s case is itself the
 * variable under test: indeterminate indicators (spinner, shimmer) legitimately
 * convey no endpoint. Most indicators ignore `seed` too — do NOT add it to the
 * five that have no use for it. A function declaring fewer props is assignable
 * to this type, which is exactly why they need no changes.
 */
export type LoadingIndicator = (props: {
  progress: number
  seed: number
}) => ReactNode

/**
 * Every indicator, keyed by `ExperimentVariant.id`.
 *
 * Adding a new one is: a component file, a line here, and a row in BOTH seed
 * mirrors (`src/lib/data/seed.ts` and `supabase/seed.sql`). Nothing in the
 * runner, the Elo layer, the hooks or the schema needs to change — they all
 * dispatch on `variant.id`.
 *
 * Keys must match the seeded variant ids exactly. A mismatch renders an empty
 * canvas with no error, so there is a test pinning the two together.
 */
export const loadingIndicators: Record<string, LoadingIndicator> = {
  classic_spinner: ClassicSpinner,
  progress_bar: ProgressBarIndicator,
  skeleton: SkeletonLoader,
  baking: BakingIndicator,
  quote: QuoteIndicator,
  blank: BlankIndicator,
}
