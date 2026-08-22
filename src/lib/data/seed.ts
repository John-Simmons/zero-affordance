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
      'The goal of this experiment is to determine if the type of animation shown while loading a webpage can affect the perceived duration of the loading time. This experiment uses six different loading animations and presents them in pairs, in a randomized order, until every combination has been presented. Your answers in this experiment will contribute to a global score for each loading animation.',
    hypothesis:
      'Perceived duration depends on what a loading indicator shows, not just how long it runs.',
    kind: 'pairwise',
    // Not used by pairwise experiments (the outcome is a vote, not a scale),
    // but `Experiment` requires them. The runner asks its own question, in its
    // own words — the prompt names the interaction ("click one below"), which
    // is the screen's business and not a fact about the experiment.
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
        description: 'A rotating arc.',
      },
      {
        id: 'progress_bar',
        label: 'Progress bar',
        description: 'A determinate bar filling from 0% to 100%.',
      },
      {
        id: 'skeleton',
        label: 'Skeleton',
        description:
          'Shimmering placeholders shaped like the content that is loading.',
      },
      {
        id: 'baking',
        label: 'Cooking a meal',
        description: 'A multi-part cooking animation: pour, stir, then bake.',
      },
      {
        id: 'quote',
        label: 'Quote',
        description: 'A randomized quote, with an animated ellipsis.',
      },
      {
        id: 'blank',
        label: 'Blank screen',
        description: 'Nothing at all — the control condition.',
      },
    ],
  },
]
