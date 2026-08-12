-- Seed content — mirrors src/lib/data/seed.ts so the Supabase-backed app shows
-- the same starter survey and experiment as the local mock.

insert into public.surveys (id, slug, title, description, position) values
  (
    'srv_tech_habits',
    'technology-habits',
    'How do you really use your devices?',
    'A quick self-report on the small interactions that shape your day. Results update live as others respond.',
    0
  )
on conflict (id) do nothing;

insert into public.survey_questions
  (id, survey_id, prompt, type, required, min, max, min_label, max_label, options, position)
values
  (
    'q_notifications', 'srv_tech_habits',
    'How do notifications on your phone usually make you feel?',
    'single_choice', true, null, null, null, null,
    '[{"id":"calm","label":"Mostly calm — I control them"},{"id":"neutral","label":"Neutral / I barely notice"},{"id":"anxious","label":"A little anxious or pulled-at"},{"id":"overwhelmed","label":"Often overwhelmed"}]'::jsonb,
    0
  ),
  (
    'q_friction', 'srv_tech_habits',
    'Which of these everyday frictions have you hit this week? (pick any)',
    'multiple_choice', false, null, null, null, null,
    '[{"id":"cookie","label":"Fighting a cookie banner"},{"id":"unsub","label":"Hunting for an unsubscribe link"},{"id":"cancel","label":"A hard-to-cancel subscription"},{"id":"popup","label":"A pop-up covering what I wanted"},{"id":"password","label":"An absurd password rule"}]'::jsonb,
    1
  ),
  (
    'q_ease', 'srv_tech_habits',
    'How intuitive does the technology in your life feel, overall?',
    'scale', false, 1, 5, 'Constant friction', 'Effortless', null,
    2
  ),
  (
    'q_wish', 'srv_tech_habits',
    'One interaction you wish designers would fix?',
    'text', false, null, null, null, null, null,
    3
  )
on conflict (id) do nothing;

insert into public.experiments
  (id, slug, title, description, hypothesis, kind, metric_label, metric_min, metric_max, position)
values
  (
    'exp_button_affordance',
    'button-affordance',
    'Does it look clickable?',
    'You will see one version of a call-to-action. Rate how obviously clickable it feels. We are testing whether visual affordances change perceived usability.',
    'A button with a clear border and shadow reads as more clickable than a flat, text-only variant.',
    'rating',
    'How clickable did it feel? (1–5)',
    1, 5, 0
  ),
  (
    'exp_loading_perception',
    'loading-perception',
    'Which loading state feels faster?',
    'Start a matchup and two loading indicators run back to back. You only get to watch them a single time, so give them your full attention, then say which one felt quicker. You will judge every pairing — fifteen matchups in all.',
    'Perceived duration depends on what a loading indicator shows, not just how long it runs. Indicators that convey definite progress should feel faster than ones that merely signal activity, even when they take longer.',
    'pairwise',
    'Which one felt faster?',
    0, 0, 1
  )
on conflict (id) do nothing;

insert into public.experiment_variants (id, experiment_id, label, description, position) values
  ('solid', 'exp_button_affordance', 'Solid + shadow', 'High-affordance: filled background, border, subtle shadow.', 0),
  ('flat',  'exp_button_affordance', 'Flat text', 'Low-affordance: text-only, no background or border.', 1)
on conflict (experiment_id, id) do nothing;

-- Every variant shares a 2500ms base, jittered ±200ms per matchup. Identical
-- bases decorrelate duration from identity: no variant is systematically the
-- quick one, so "felt faster" cannot collapse into "was shorter".
--
-- Ids must match the keys in src/features/experiments/indicators/index.ts.
insert into public.experiment_variants
  (id, experiment_id, label, description, base_duration_ms, jitter_ms, position)
values
  ('classic_spinner', 'exp_loading_perception', 'Classic spinner', 'A rotating arc. Signals activity, promises nothing.', 2500, 200, 0),
  ('progress_bar',    'exp_loading_perception', 'Progress bar', 'A determinate bar filling from empty to full.', 2500, 200, 1),
  ('skeleton',        'exp_loading_perception', 'Skeleton', 'Shimmering placeholders shaped like the content that is coming.', 2500, 200, 2),
  ('baking',          'exp_loading_perception', 'Baking a loaf', 'An illustrated bake: dough rises, the oven warms, steam lifts off the loaf.', 2500, 200, 3),
  ('quote',           'exp_loading_perception', 'Quote', 'Something to read, with an animated ellipsis.', 2500, 200, 4),
  ('blank',           'exp_loading_perception', 'Blank screen', 'Nothing at all — the control condition.', 2500, 200, 5)
on conflict (experiment_id, id) do nothing;
