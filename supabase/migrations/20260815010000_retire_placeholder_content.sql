-- Retire the two placeholder studies written at the start of the project:
-- the "technology habits" survey and the "button affordance" experiment.
--
-- Why this can't live in seed.sql alone: `supabase db push` runs migrations
-- only, and seed.sql runs on a fresh or reset database. Deleting the rows from
-- seed.sql therefore leaves them live on every environment that already ran it,
-- which is all of them.
--
-- Scope note: this removes CONTENT, not capability. The rating-experiment path
-- (ExperimentRunner, assignVariant, recordInteraction, aggregateExperiment and
-- the experiment_interactions table) is deliberately left in place, unused, for
-- the next rating-style experiment. Nothing here drops a table or a column.
--
-- Idempotent, in the same style as the other migrations.

-- 1. The survey -------------------------------------------------------------
-- survey_questions and survey_responses both cascade from surveys, so the
-- questions and any collected answers go with it. That is intended: the
-- responses only answer questions that are themselves being retired, so keeping
-- them would leave rows referencing prompts nobody can read.

delete from public.surveys where id = 'srv_tech_habits';

-- 2. The rating experiment ---------------------------------------------------
-- experiment_variants and experiment_interactions cascade from experiments.

delete from public.experiments where id = 'exp_button_affordance';

-- Its variants carry a composite primary key (experiment_id, id) and are not
-- FK-referenced from anywhere else, but delete them explicitly in case an
-- environment somehow holds variants whose parent row already went.
delete from public.experiment_variants
 where experiment_id = 'exp_button_affordance';

-- 3. Anything recorded against them ------------------------------------------
-- experiment_matches has NO foreign key on experiment_id (see the pairwise
-- migration), so nothing cascades to it. The loading-perception experiment is
-- the only pairwise one and is untouched, but a stray row naming the retired
-- experiment would otherwise linger forever.

delete from public.experiment_matches
 where experiment_id = 'exp_button_affordance';
