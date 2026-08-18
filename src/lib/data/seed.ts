/**
 * Sample content used by the mock adapter (and mirrored in supabase/seed.sql).
 *
 * These exist so the site renders something meaningful with zero backend setup,
 * and they double as living documentation of the domain shapes.
 */
import type { Experiment, Survey } from '@/lib/data/types'

/**
 * No surveys seeded right now — the placeholder "technology habits" survey was
 * retired. The whole survey path (runner, results, aggregation, tables) is
 * intact and waiting for real content.
 */
export const seedSurveys: Survey[] = []

export const seedExperiments: Experiment[] = [
  {
    id: 'exp_loading_perception',
    slug: 'loading-perception',
    title: 'Which loading state feels faster?',
    description:
      'Start a matchup and two loading indicators run back to back. You only get to watch them a single time, so give them your full attention, then say which one felt quicker. You will judge every pairing — fifteen matchups in all.',
    hypothesis:
      'Perceived duration depends on what a loading indicator shows, not just how long it runs. Indicators that convey definite progress should feel faster than ones that merely signal activity, even when they take longer.',
    kind: 'pairwise',
    // Not used by pairwise experiments (the outcome is a vote, not a scale),
    // but `Experiment` requires them; metricLabel doubles as the vote prompt.
    metricLabel: 'Which one felt faster?',
    metricMin: 0,
    metricMax: 0,
    // Variants declare no durations at all. A matchup draws one base for both
    // sides and jitters each around it (`rollMatchupDurations` in aggregate.ts),
    // which decorrelates duration from identity outright: no variant is
    // systematically the quick one, so "felt faster" cannot collapse into "was
    // shorter". The base moves between matchups so it cannot be learned either.
    // Ids must match the keys in `features/experiments/indicators/index.ts`.
    // They also deliberately differ from the retired text placeholders
    // (dots/spinner/percent/bar/phases): reusing an id would fold matches
    // against the old text stand-in into the real animation's rating.
    variants: [
      {
        id: 'classic_spinner',
        label: 'Classic spinner',
        description: 'A rotating arc. Signals activity, promises nothing.',
      },
      {
        id: 'progress_bar',
        label: 'Progress bar',
        description: 'A determinate bar filling from empty to full.',
      },
      {
        id: 'skeleton',
        label: 'Skeleton',
        description:
          'Shimmering placeholders shaped like the content that is coming.',
      },
      {
        id: 'baking',
        label: 'Cooking a meal',
        description:
          'An illustrated cook in three acts: pour, stir, then bake.',
      },
      {
        id: 'quote',
        label: 'Quote',
        description: 'Something to read, with an animated ellipsis.',
      },
      {
        id: 'blank',
        label: 'Blank screen',
        description: 'Nothing at all — the control condition.',
      },
    ],
  },
]
