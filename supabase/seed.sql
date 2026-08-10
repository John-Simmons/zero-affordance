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
  (id, slug, title, description, hypothesis, metric_label, metric_min, metric_max, position)
values
  (
    'exp_button_affordance',
    'button-affordance',
    'Does it look clickable?',
    'You will see one version of a call-to-action. Rate how obviously clickable it feels. We are testing whether visual affordances change perceived usability.',
    'A button with a clear border and shadow reads as more clickable than a flat, text-only variant.',
    'How clickable did it feel? (1–5)',
    1, 5, 0
  )
on conflict (id) do nothing;

insert into public.experiment_variants (id, experiment_id, label, description, position) values
  ('solid', 'exp_button_affordance', 'Solid + shadow', 'High-affordance: filled background, border, subtle shadow.', 0),
  ('flat',  'exp_button_affordance', 'Flat text', 'Low-affordance: text-only, no background or border.', 1)
on conflict (experiment_id, id) do nothing;
