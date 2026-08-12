-- Swap the loading-perception experiment's five text placeholders for the six
-- real animations.
--
-- Why this can't live in seed.sql alone: that file inserts with
-- `on conflict do nothing`, so on any environment that already ran it the old
-- five rows would simply REMAIN alongside the six new ones — eleven variants,
-- and a 55-matchup round robin instead of 15.
--
-- Idempotent, in the same style as the other migrations.

-- 1. The experiment row itself -----------------------------------------------
--
-- This has to be here, not just in seed.sql. `supabase db push` runs migrations
-- only — seed.sql is for fresh/reset databases — so on an environment seeded
-- before this branch the experiment simply does not exist, and step 3 below
-- would abort on the experiment_variants -> experiments foreign key.
--
-- Mirrors src/lib/data/seed.ts. `kind` matters: the column defaults to
-- 'rating', which would route this experiment to the wrong runner.

insert into public.experiments
  (id, slug, title, description, hypothesis, kind, metric_label, metric_min, metric_max, position)
values
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
on conflict (id) do update set
  slug = excluded.slug,
  title = excluded.title,
  description = excluded.description,
  hypothesis = excluded.hypothesis,
  kind = excluded.kind,
  metric_label = excluded.metric_label,
  metric_min = excluded.metric_min,
  metric_max = excluded.metric_max,
  position = excluded.position;

-- 2. Retire the text placeholders --------------------------------------------

delete from public.experiment_variants
where experiment_id = 'exp_loading_perception'
  and id in ('dots', 'spinner', 'percent', 'bar', 'phases');

-- Matches referencing those ids are deliberately LEFT IN PLACE. They are
-- immutable history, there is no FK on experiment_matches.variant_a_id /
-- variant_b_id (see the init migration), and computeElo() skips matches naming
-- variants the experiment no longer declares. The leaderboard effectively
-- resets, which is correct — the stimuli are genuinely different things.

-- 3. The six real indicators -------------------------------------------------
-- Ids must match the keys in src/features/experiments/indicators/index.ts.
-- Every variant shares a 2500ms base, jittered ±200ms per matchup. Identical
-- bases decorrelate duration from identity: no variant is systematically the
-- quick one, so "felt faster" cannot collapse into "was shorter".

insert into public.experiment_variants
  (id, experiment_id, label, description, base_duration_ms, jitter_ms, position)
values
  ('classic_spinner', 'exp_loading_perception', 'Classic spinner', 'A rotating arc. Signals activity, promises nothing.', 2500, 200, 0),
  ('progress_bar',    'exp_loading_perception', 'Progress bar', 'A determinate bar filling from empty to full.', 2500, 200, 1),
  ('skeleton',        'exp_loading_perception', 'Skeleton', 'Shimmering placeholders shaped like the content that is coming.', 2500, 200, 2),
  ('baking',          'exp_loading_perception', 'Baking a loaf', 'An illustrated bake: dough rises, the oven warms, steam lifts off the loaf.', 2500, 200, 3),
  ('quote',           'exp_loading_perception', 'Quote', 'Something to read, with an animated ellipsis.', 2500, 200, 4),
  ('blank',           'exp_loading_perception', 'Blank screen', 'Nothing at all — the control condition.', 2500, 200, 5)
on conflict (experiment_id, id) do update set
  label = excluded.label,
  description = excluded.description,
  base_duration_ms = excluded.base_duration_ms,
  jitter_ms = excluded.jitter_ms,
  position = excluded.position;

-- The description (including the matchup count) is set by the upsert in step 1,
-- so there is deliberately no separate UPDATE here — one source for that string
-- rather than two that can disagree.
