-- Retitle the `baking` variant: the hand-coded bake was redrawn as a three-act
-- cook (pour, stir, bake), so its label and description no longer describe what
-- the participant watches.
--
-- Why this can't live in seed.sql alone: that file inserts with
-- `on conflict (experiment_id, id) do nothing`, and every environment has
-- already run it — the row exists, so the new copy would simply be discarded
-- and the standings would keep advertising a loaf that no longer appears.
--
-- Copy only. The id is deliberately unchanged, so nothing here touches
-- experiment_matches: computeElo replays every match naming a variant the
-- experiment still declares, and this one still declares `baking`. The rating
-- carries over intact, which is the point — what is under test is the format
-- (an illustrated narrative that visibly advances), and that has not changed.
--
-- Mirrors src/lib/data/seed.ts. Idempotent, in the same style as the other
-- migrations.

update public.experiment_variants
set
  label = 'Cooking a meal',
  description = 'An illustrated cook in three acts: pour, stir, then bake.'
where experiment_id = 'exp_loading_perception'
  and id = 'baking';
