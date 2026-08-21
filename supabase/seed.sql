-- Seed content — mirrors src/lib/data/seed.ts.
--
-- The placeholder survey ("technology habits") and the button-affordance
-- experiment were retired, so only the loading-perception experiment is seeded.
-- No surveys are seeded at the moment; the survey tables and the whole survey
-- path remain, waiting for real content.
--
-- Note this file only runs on a fresh or reset database. Removing rows here
-- does NOT retire them on an environment that already ran the old seed — see
-- the retire_placeholder_content migration for that.

insert into public.experiments
  (id, slug, title, description, hypothesis, kind, metric_label, metric_min, metric_max, position)
values
  (
    'exp_loading_perception',
    'loading-perception',
    'Which loading state feels faster?',
    'The goal of this experiment is to determine if the type of animation shown while loading a webpage can affect the perceived duration of the loading time. This experiment uses six different loading animations and presents them in pairs, in a randomized order, until every combination has been presented. Your answers in this experiment will contribute to a global Elo score for each loading animation.',
    'Perceived duration depends on what a loading indicator shows, not just how long it runs.',
    'pairwise',
    'Which one felt faster?',
    0, 0, 0
  )
on conflict (id) do nothing;

-- Variants carry no durations. A matchup draws one base for both sides and
-- jitters each around it (rollMatchupDurations in src/lib/data/aggregate.ts),
-- which decorrelates duration from identity: no variant is systematically the
-- quick one, so "felt faster" cannot collapse into "was shorter". The base
-- moves between matchups so it cannot be learned across a run either.
--
-- Ids must match the keys in src/features/experiments/indicators/index.ts.
insert into public.experiment_variants
  (id, experiment_id, label, description, position)
values
  ('classic_spinner', 'exp_loading_perception', 'Classic spinner', 'A rotating arc.', 0),
  ('progress_bar',    'exp_loading_perception', 'Progress bar', 'A determinate bar filling from 0% to 100%.', 1),
  ('skeleton',        'exp_loading_perception', 'Skeleton', 'Shimmering placeholders shaped like the content that is loading.', 2),
  ('baking',          'exp_loading_perception', 'Cooking a meal', 'A multi-part cooking animation: pour, stir, then bake.', 3),
  ('quote',           'exp_loading_perception', 'Quote', 'A randomized quote, with an animated ellipsis.', 4),
  ('blank',           'exp_loading_perception', 'Blank screen', 'Nothing at all — the control condition.', 5)
on conflict (experiment_id, id) do nothing;
