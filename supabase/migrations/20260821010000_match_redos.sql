-- Record whether a matchup was replayed before its vote was cast.
--
-- The runner lets a participant redo a matchup once — same variants, same
-- order, same durations, same seed — for the case where attention slipped and
-- the two loading states could not honestly be compared. See `REDOS_PER_MATCHUP`
-- in src/features/experiments/pairwise-runner.tsx.
--
-- Why the flag has to be stored rather than inferred: a redo produces no row of
-- its own. It changes how one judgement was arrived at, not how many judgements
-- there are, so from the match log alone a redone matchup is indistinguishable
-- from any other. And matches are append-only (no UPDATE policy, by design), so
-- a vote recorded without this cannot be annotated afterwards — the information
-- is either captured at insert time or lost.
--
-- Nothing in the Elo replay reads it. `computeElo` weights every match equally
-- whether or not it was redone; this exists so that choice can be revisited
-- with evidence, e.g. checking whether second viewings vote differently.
--
-- `default false` is honest for the existing rows: they were recorded before a
-- redo was possible, so none of them was one.
--
-- A boolean rather than a count because the cap is one per matchup. Raising the
-- cap means widening this column, which is its own migration.
--
-- Idempotent, in the same style as the other migrations.

alter table public.experiment_matches
  add column if not exists redone boolean not null default false;
