-- Drops "Elo" from the experiment brief: src/lib/data/seed.ts now says
-- "a global score for each loading animation" rather than "a global Elo
-- score". The term is still on the results screen, where the standings table
-- names the column and a popover explains it — the brief is read before anyone
-- has seen either, and naming a rating system there explained nothing.
--
-- Same reasoning as 20260821000000_loading_perception_copy.sql: seed.ts feeds
-- only the localStorage mock, and seed.sql inserts with `on conflict … do
-- nothing`, so an environment that has already been seeded keeps the old
-- wording until an explicit update runs. seed.sql is updated alongside, for
-- databases created from scratch.
--
-- Copy only. No ids, labels, or positions change, so nothing here touches
-- experiment_matches and every Elo rating carries over intact.

update public.experiments
set description = 'The goal of this experiment is to determine if the type of animation shown while loading a webpage can affect the perceived duration of the loading time. This experiment uses six different loading animations and presents them in pairs, in a randomized order, until every combination has been presented. Your answers in this experiment will contribute to a global score for each loading animation.'
where id = 'exp_loading_perception';
