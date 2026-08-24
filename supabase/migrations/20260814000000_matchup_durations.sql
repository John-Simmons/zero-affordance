-- Retire the per-variant duration columns.
--
-- Durations moved from the variant to the matchup: a matchup now draws ONE base
-- duration from a band and jitters each side around it, rather than each variant
-- declaring its own base. See `rollMatchupDurations` in
-- src/lib/data/aggregate.ts.
--
-- Two reasons the columns cannot simply be left in place:
--
--   1. Nothing reads them any more. The Supabase adapter no longer selects them
--      and `ExperimentVariant` no longer carries them, so a row saying 2500 is
--      a claim about behaviour that is no longer true — the kind of stale
--      declaration that eventually gets believed.
--   2. Keeping them invites re-introducing per-variant durations, which is the
--      exact confound the design removes: if one variant were systematically
--      shorter, "felt faster" and "was shorter" would be indistinguishable in
--      the ratings.
--
-- Recorded match durations are NOT touched. `experiment_matches.duration_a_ms`
-- / `duration_b_ms` are observations of what actually ran, and the Elo handicap
-- replays them — dropping or rewriting those would silently re-rate history.
--
-- Idempotent, in the same style as the other migrations.

alter table public.experiment_variants
  drop column if exists base_duration_ms;

alter table public.experiment_variants
  drop column if exists jitter_ms;
