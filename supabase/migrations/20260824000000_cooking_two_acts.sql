-- Re-describe the `baking` variant: the cook lost its pour. The three-act
-- animation was cut to two — stir, then bake — so the description promises a
-- scene the participant never sees, and the acts it does name now run at half
-- the wait each rather than a third.
--
-- Why this can't live in seed.sql alone: that file inserts with
-- `on conflict (experiment_id, id) do nothing`, and every environment has
-- already run it, so the rewritten string would simply be discarded. seed.sql
-- is updated alongside, for databases created from scratch.
--
-- Copy only. No ids, labels, or positions change, so nothing here touches
-- experiment_matches and every Elo rating carries over intact — the same trade
-- the earlier redraws made, and for the same reason: what is under test is the
-- format (an illustrated narrative that visibly advances), which the shorter
-- cook still is.
--
-- Mirrors src/lib/data/seed.ts. Idempotent, in the same style as the other
-- migrations.

update public.experiment_variants
set description = 'A multi-part cooking animation: stir, then bake.'
where experiment_id = 'exp_loading_perception'
  and id = 'baking';
