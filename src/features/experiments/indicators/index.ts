import type { ReactNode } from 'react'

import { BakingIndicator } from '@/features/experiments/indicators/baking-indicator'
import { BlankIndicator } from '@/features/experiments/indicators/blank-indicator'
import { ClassicSpinner } from '@/features/experiments/indicators/classic-spinner'
import { ProgressBarIndicator } from '@/features/experiments/indicators/progress-bar'
import { QuoteIndicator } from '@/features/experiments/indicators/quote-indicator'
import { SkeletonLoader } from '@/features/experiments/indicators/skeleton-loader'

/**
 * A loading indicator: a pure function of how far through the wait we are.
 *
 * `progress` runs 0 → 1 over the duration this matchup assigned the variant.
 * Indicators must never run on their own clock for anything that implies
 * completion — the Elo handicap corrects for the assigned duration, so an
 * animation that finished early or ran past the end would be measuring
 * something that didn't happen.
 *
 * Ignoring `progress` entirely is fine, and is itself the variable under test:
 * indeterminate indicators (spinner, shimmer) legitimately convey no endpoint.
 */
export type LoadingIndicator = (props: { progress: number }) => ReactNode

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
