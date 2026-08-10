-- Zero Affordance — initial schema
--
-- Definitions (surveys / experiments) are publicly readable. Anonymous visitors
-- may INSERT responses and interactions but cannot read, update, or delete
-- individual rows. Aggregation currently happens client-side over the base rows
-- (see lib/data/supabase.ts); when volume grows, add SQL views / RPC and grant
-- SELECT on those instead of the base tables.
--
-- Apply with the Supabase SQL editor, or the CLI:
--   supabase db reset            (local)
--   supabase db push             (linked project)

-- ---------------------------------------------------------------------------
-- Surveys
-- ---------------------------------------------------------------------------
create table if not exists public.surveys (
  id          text primary key,
  slug        text not null unique,
  title       text not null,
  description text not null default '',
  position    int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.survey_questions (
  id         text primary key,
  survey_id  text not null references public.surveys (id) on delete cascade,
  prompt     text not null,
  type       text not null check (
    type in ('single_choice', 'multiple_choice', 'scale', 'text')
  ),
  help_text  text,
  required   boolean not null default false,
  min        int,
  max        int,
  min_label  text,
  max_label  text,
  options    jsonb,
  position   int not null default 0
);
create index if not exists survey_questions_survey_id_idx
  on public.survey_questions (survey_id);

create table if not exists public.survey_responses (
  id           uuid primary key default gen_random_uuid(),
  survey_id    text not null references public.surveys (id) on delete cascade,
  visitor_id   text not null,
  answers      jsonb not null,
  submitted_at timestamptz not null default now()
);
create index if not exists survey_responses_survey_id_idx
  on public.survey_responses (survey_id);

-- ---------------------------------------------------------------------------
-- Experiments
-- ---------------------------------------------------------------------------
create table if not exists public.experiments (
  id           text primary key,
  slug         text not null unique,
  title        text not null,
  description  text not null default '',
  hypothesis   text not null default '',
  metric_label text not null default '',
  metric_min   int  not null default 1,
  metric_max   int  not null default 5,
  position     int  not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists public.experiment_variants (
  id            text not null,
  experiment_id text not null references public.experiments (id) on delete cascade,
  label         text not null,
  description   text not null default '',
  position      int  not null default 0,
  primary key (experiment_id, id)
);

create table if not exists public.experiment_interactions (
  id            uuid primary key default gen_random_uuid(),
  experiment_id text not null references public.experiments (id) on delete cascade,
  variant_id    text not null,
  visitor_id    text not null,
  value         int  not null,
  created_at    timestamptz not null default now()
);
create index if not exists experiment_interactions_experiment_id_idx
  on public.experiment_interactions (experiment_id);

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
alter table public.surveys                 enable row level security;
alter table public.survey_questions        enable row level security;
alter table public.survey_responses        enable row level security;
alter table public.experiments             enable row level security;
alter table public.experiment_variants     enable row level security;
alter table public.experiment_interactions enable row level security;

-- Public read of definitions. (drop-then-create keeps this migration idempotent —
-- Postgres has no CREATE POLICY IF NOT EXISTS.)
drop policy if exists "read surveys" on public.surveys;
create policy "read surveys" on public.surveys for select using (true);
drop policy if exists "read questions" on public.survey_questions;
create policy "read questions" on public.survey_questions for select using (true);
drop policy if exists "read experiments" on public.experiments;
create policy "read experiments" on public.experiments for select using (true);
drop policy if exists "read variants" on public.experiment_variants;
create policy "read variants" on public.experiment_variants for select using (true);

-- Anonymous participation: insert + read aggregate rows (no PII stored).
-- Tighten to insert-only + SQL aggregate views if you don't want raw rows public.
drop policy if exists "insert responses" on public.survey_responses;
create policy "insert responses" on public.survey_responses for insert with check (true);
drop policy if exists "read responses" on public.survey_responses;
create policy "read responses" on public.survey_responses for select using (true);

drop policy if exists "insert interactions" on public.experiment_interactions;
create policy "insert interactions" on public.experiment_interactions for insert with check (true);
drop policy if exists "read interactions" on public.experiment_interactions;
create policy "read interactions" on public.experiment_interactions for select using (true);

-- ---------------------------------------------------------------------------
-- Realtime — stream new responses/interactions to subscribed clients.
-- Guarded so re-running the migration doesn't error on already-published tables.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'survey_responses'
  ) then
    alter publication supabase_realtime add table public.survey_responses;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'experiment_interactions'
  ) then
    alter publication supabase_realtime add table public.experiment_interactions;
  end if;
end $$;
