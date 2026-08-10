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
]
