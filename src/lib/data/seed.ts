/**
 * Sample content used by the mock adapter (and mirrored in supabase/seed.sql).
 *
 * These exist so the site renders something meaningful with zero backend setup,
 * and they double as living documentation of the domain shapes.
 */
import type { Experiment, Survey } from '@/lib/data/types'

export const seedSurveys: Survey[] = [
  {
    id: 'srv_tech_habits',
    slug: 'technology-habits',
    title: 'How do you really use your devices?',
    description:
      'A quick self-report on the small interactions that shape your day. Results update live as others respond.',
    questions: [
      {
        id: 'q_notifications',
        prompt: 'How do notifications on your phone usually make you feel?',
        type: 'single_choice',
        required: true,
        options: [
          { id: 'calm', label: 'Mostly calm — I control them' },
          { id: 'neutral', label: 'Neutral / I barely notice' },
          { id: 'anxious', label: 'A little anxious or pulled-at' },
          { id: 'overwhelmed', label: 'Often overwhelmed' },
        ],
      },
      {
        id: 'q_friction',
        prompt:
          'Which of these everyday frictions have you hit this week? (pick any)',
        type: 'multiple_choice',
        options: [
          { id: 'cookie', label: 'Fighting a cookie banner' },
          { id: 'unsub', label: 'Hunting for an unsubscribe link' },
          { id: 'cancel', label: 'A hard-to-cancel subscription' },
          { id: 'popup', label: 'A pop-up covering what I wanted' },
          { id: 'password', label: 'An absurd password rule' },
        ],
      },
      {
        id: 'q_ease',
        prompt: 'How intuitive does the technology in your life feel, overall?',
        type: 'scale',
        min: 1,
        max: 5,
        minLabel: 'Constant friction',
        maxLabel: 'Effortless',
      },
      {
        id: 'q_wish',
        prompt: 'One interaction you wish designers would fix?',
        type: 'text',
      },
    ],
  },
]

export const seedExperiments: Experiment[] = [
  {
    id: 'exp_button_affordance',
    slug: 'button-affordance',
    title: 'Does it look clickable?',
    description:
      'You will see one version of a call-to-action. Rate how obviously clickable it feels. We are testing whether visual affordances change perceived usability.',
    hypothesis:
      'A button with a clear border and shadow reads as more clickable than a flat, text-only variant.',
    kind: 'rating',
    metricLabel: 'How clickable did it feel? (1–5)',
    metricMin: 1,
    metricMax: 5,
    variants: [
      {
        id: 'solid',
        label: 'Solid + shadow',
        description:
          'High-affordance: filled background, border, subtle shadow.',
      },
      {
        id: 'flat',
        label: 'Flat text',
        description: 'Low-affordance: text-only, no background or border.',
      },
    ],
  },
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
    // Every variant shares the same 2500ms base, jittered ±200ms per matchup.
    // Identical bases decorrelate duration from identity outright: no variant is
    // systematically the quick one, so "felt faster" cannot collapse into "was
    // shorter". The jitter is what remains for the Elo handicap to correct, and
    // it is symmetric across variants.
    // Ids must match the keys in `features/experiments/indicators/index.ts`.
    // They also deliberately differ from the retired text placeholders
    // (dots/spinner/percent/bar/phases): reusing an id would fold matches
    // against the old text stand-in into the real animation's rating.
    variants: [
      {
        id: 'classic_spinner',
        label: 'Classic spinner',
        description: 'A rotating arc. Signals activity, promises nothing.',
        baseDurationMs: 2500,
        jitterMs: 200,
      },
      {
        id: 'progress_bar',
        label: 'Progress bar',
        description: 'A determinate bar filling from empty to full.',
        baseDurationMs: 2500,
        jitterMs: 200,
      },
      {
        id: 'skeleton',
        label: 'Skeleton',
        description:
          'Shimmering placeholders shaped like the content that is coming.',
        baseDurationMs: 2500,
        jitterMs: 200,
      },
      {
        id: 'baking',
        label: 'Baking a loaf',
        description:
          'An illustrated bake: dough rises, the oven warms, steam lifts off the loaf.',
        baseDurationMs: 2500,
        jitterMs: 200,
      },
      {
        id: 'quote',
        label: 'Quote',
        description: 'Something to read, with an animated ellipsis.',
        baseDurationMs: 2500,
        jitterMs: 200,
      },
      {
        id: 'blank',
        label: 'Blank screen',
        description: 'Nothing at all — the control condition.',
        baseDurationMs: 2500,
        jitterMs: 200,
      },
    ],
  },
]
