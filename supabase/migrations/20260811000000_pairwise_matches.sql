-- Pairwise experiments: head-to-head matchups feeding a global Elo ranking.
--
-- Design note: matches are stored immutably and ratings are DERIVED by replaying
-- them, rather than kept in a mutable ratings table. That keeps the Elo formula
-- in exactly one place (src/lib/data/aggregate.ts, shared by both adapters),
-- avoids needing an UPDATE policy for anonymous visitors, and lets the K-factor
-- be retuned later without a backfill.
--
-- Idempotent, in the same style as the init migration.

-- 1. How an experiment is played -------------------------------------------

alter table public.experiments
  add column if not exists kind text not null default 'rating';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'experiments_kind_check'
  ) then
    alter table public.experiments
      add constraint experiments_kind_check check (kind in ('rating', 'pairwise'));
  end if;
end $$;

-- 2. Per-variant timing (pairwise only; null for rating experiments) --------

alter table public.experiment_variants
  add column if not exists base_duration_ms int;
alter table public.experiment_variants
  add column if not exists jitter_ms int;

-- 3. The matches themselves --------------------------------------------------
-- Durations are recorded per row rather than looked up from the variant, so
-- retuning a variant's timing later cannot retroactively rewrite history.

create table if not exists public.experiment_matches (
  id uuid primary key default gen_random_uuid(),
  experiment_id text not null references public.experiments (id) on delete cascade,
  visitor_id text not null,
  variant_a_id text not null,
  variant_b_id text not null,
  duration_a_ms int not null,
  duration_b_ms int not null,
  outcome text not null check (outcome in ('a', 'b', 'tie')),
  created_at timestamptz not null default now(),
  constraint experiment_matches_distinct_variants check (variant_a_id <> variant_b_id)
);

-- Elo replay reads every row for an experiment in creation order.
create index if not exists experiment_matches_experiment_created_idx
  on public.experiment_matches (experiment_id, created_at, id);

-- 4. RLS ---------------------------------------------------------------------
-- Insert + select for anon, matching the other participation tables. No UPDATE
-- or DELETE policy: the append-only design is what makes that unnecessary.

alter table public.experiment_matches enable row level security;

drop policy if exists "insert matches" on public.experiment_matches;
create policy "insert matches" on public.experiment_matches for insert with check (true);
drop policy if exists "read matches" on public.experiment_matches;
create policy "read matches" on public.experiment_matches for select using (true);

-- 5. Realtime ----------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'experiment_matches'
  ) then
    alter publication supabase_realtime add table public.experiment_matches;
  end if;
end $$;
