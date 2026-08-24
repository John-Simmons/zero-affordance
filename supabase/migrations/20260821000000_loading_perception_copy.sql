-- Refresh the loading-perception copy: the experiment brief, the hypothesis,
-- and five of the six variant descriptions were rewritten in
-- src/lib/data/seed.ts. That file only feeds the localStorage mock, so until
-- this runs, every Supabase-backed environment keeps serving the old wording
-- while the components around it show the new.
--
-- Why this can't live in seed.sql alone: that file inserts with
-- `on conflict … do nothing`, and every environment has already run it, so the
-- rewritten strings would simply be discarded. `supabase db push` does not help
-- either — it applies migrations, and without this file there was nothing to
-- apply. seed.sql is updated alongside, for databases created from scratch.
--
-- Copy only. No ids, labels, or positions change, so nothing here touches
-- experiment_matches and every Elo rating carries over intact.
--
-- Mirrors src/lib/data/seed.ts. Idempotent, in the same style as the other
-- migrations.

update public.experiments
set
  description = 'The goal of this experiment is to determine if the type of animation shown while loading a webpage can affect the perceived duration of the loading time. This experiment uses six different loading animations and presents them in pairs, in a randomized order, until every combination has been presented. Your answers in this experiment will contribute to a global Elo score for each loading animation.',
  hypothesis = 'Perceived duration depends on what a loading indicator shows, not just how long it runs.'
where id = 'exp_loading_perception';

update public.experiment_variants
set description = 'A rotating arc.'
where experiment_id = 'exp_loading_perception'
  and id = 'classic_spinner';

update public.experiment_variants
set description = 'A determinate bar filling from 0% to 100%.'
where experiment_id = 'exp_loading_perception'
  and id = 'progress_bar';

update public.experiment_variants
set description = 'Shimmering placeholders shaped like the content that is loading.'
where experiment_id = 'exp_loading_perception'
  and id = 'skeleton';

update public.experiment_variants
set description = 'A multi-part cooking animation: pour, stir, then bake.'
where experiment_id = 'exp_loading_perception'
  and id = 'baking';

update public.experiment_variants
set description = 'A randomized quote, with an animated ellipsis.'
where experiment_id = 'exp_loading_perception'
  and id = 'quote';

update public.experiment_variants
set description = 'Nothing at all — the control condition.'
where experiment_id = 'exp_loading_perception'
  and id = 'blank';
