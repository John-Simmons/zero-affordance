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
    'Start a matchup and two loading indicators run back to back. You only get to watch them a single time, so give them your full attention, then say which one felt quicker. You will judge every pairing — fifteen matchups in all.',
    'Perceived duration depends on what a loading indicator shows, not just how long it runs. Indicators that convey definite progress should feel faster than ones that merely signal activity, even when they take longer.',
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
  ('classic_spinner', 'exp_loading_perception', 'Classic spinner', 'A rotating arc. Signals activity, promises nothing.', 0),
  ('progress_bar',    'exp_loading_perception', 'Progress bar', 'A determinate bar filling from empty to full.', 1),
  ('skeleton',        'exp_loading_perception', 'Skeleton', 'Shimmering placeholders shaped like the content that is coming.', 2),
  ('baking',          'exp_loading_perception', 'Baking a loaf', 'An illustrated bake: dough rises, the oven warms, steam lifts off the loaf.', 3),
  ('quote',           'exp_loading_perception', 'Quote', 'Something to read, with an animated ellipsis.', 4),
  ('blank',           'exp_loading_perception', 'Blank screen', 'Nothing at all — the control condition.', 5)
on conflict (experiment_id, id) do nothing;
