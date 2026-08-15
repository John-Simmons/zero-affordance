-- Video ideas: public, unattributable idea posts with one upvote per visitor.
--
-- This is the first genuinely public, persistent, user-authored text on the
-- site. Everything before it was anonymous numeric telemetry, so two of the
-- house defaults are deliberately NOT copied here.
--
-- 1. `idea_votes` is unreadable by the client. The obvious design counts votes
--    with an embedded aggregate, the way listSurveys() does `survey_questions
--    (count)` — but that needs anon SELECT on the votes table, which would
--    publish every voter's visitor_id. That id is the same one the experiments
--    feature uses, so it would correlate a person's votes with their experiment
--    activity. Instead the table has RLS on and NO policies, plus an explicit
--    revoke, and `video_ideas.vote_count` is maintained for it.
--
-- 2. **The invariant has moved.** Elsewhere in this schema the rule is "anon
--    holds no UPDATE or DELETE policy anywhere", and the append-only design is
--    what makes that safe. An upvote toggle has to delete a row, and a blanket
--    `delete using (true)` would let anyone issue one unfiltered
--    `DELETE /idea_votes` and wipe every vote on the site — PostgREST does not
--    require a filter. So the rule here is: anon holds no UPDATE or DELETE
--    *grant*, and the only privileged path is one security-definer function
--    that filters on both of its parameters. Do not read safety off the policy
--    list alone.
--
-- Idempotent, in the same style as the other migrations.

-- 1. Tables ------------------------------------------------------------------

create table if not exists public.video_ideas (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(btrim(title)) between 1 and 80),
  description text not null check (length(btrim(description)) between 1 and 500),
  created_at  timestamptz not null default now(),
  -- Denormalised because the votes table is unreadable (see header). Written
  -- only by toggle_idea_vote(), and RECOMPUTED there rather than incremented,
  -- so an interrupted call or a manual row deletion from the dashboard
  -- self-corrects instead of leaving a permanently wrong number.
  vote_count  int not null default 0
);

create index if not exists video_ideas_ranking_idx
  on public.video_ideas (vote_count desc, created_at desc);

create table if not exists public.idea_votes (
  idea_id    uuid not null references public.video_ideas (id) on delete cascade,
  visitor_id text not null,
  created_at timestamptz not null default now(),
  -- The composite key IS the "one vote per idea per visitor" rule.
  primary key (idea_id, visitor_id)
);

-- 2. RLS ---------------------------------------------------------------------

alter table public.video_ideas enable row level security;
alter table public.idea_votes  enable row level security;

-- drop-then-create keeps this idempotent — Postgres has no
-- CREATE POLICY IF NOT EXISTS.
drop policy if exists "insert ideas" on public.video_ideas;
create policy "insert ideas" on public.video_ideas for insert with check (true);

-- Needed by Realtime as well as by reads: postgres_changes only delivers rows
-- the subscribing role could SELECT.
drop policy if exists "read ideas" on public.video_ideas;
create policy "read ideas" on public.video_ideas for select using (true);

-- idea_votes gets NO policies at all. RLS with no policy denies everything; the
-- revoke is belt and braces against Supabase's default grants.
revoke all on public.idea_votes from anon, authenticated;

-- 3. Toggle ------------------------------------------------------------------

create or replace function public.toggle_idea_vote(
  p_idea_id    uuid,
  p_visitor_id text
)
returns table (idea_id uuid, vote_count int, voted boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted int;
  v_count   int;
  v_voted   boolean;
begin
  if p_visitor_id is null
     or length(btrim(p_visitor_id)) = 0
     or length(p_visitor_id) > 64 then
    raise exception 'invalid visitor id';
  end if;

  -- Serialises concurrent toggles on the same idea, so the counter and the
  -- vote rows can never drift apart.
  perform 1 from public.video_ideas i where i.id = p_idea_id for update;
  if not found then
    raise exception 'unknown idea %', p_idea_id;
  end if;

  delete from public.idea_votes v
   where v.idea_id = p_idea_id and v.visitor_id = p_visitor_id;
  get diagnostics v_deleted = row_count;

  if v_deleted = 0 then
    insert into public.idea_votes (idea_id, visitor_id)
         values (p_idea_id, p_visitor_id)
    on conflict (idea_id, visitor_id) do nothing;
    v_voted := true;
  else
    v_voted := false;
  end if;

  update public.video_ideas i
     set vote_count = (
       select count(*) from public.idea_votes v where v.idea_id = i.id
     )
   where i.id = p_idea_id
  returning i.vote_count into v_count;

  return query select p_idea_id, v_count, v_voted;
end;
$$;

revoke all on function public.toggle_idea_vote(uuid, text) from public;
grant execute on function public.toggle_idea_vote(uuid, text) to anon;

-- 4. Listing -----------------------------------------------------------------
-- One round trip and one indexed scan of this visitor's votes. Deliberately not
-- a correlated EXISTS per row, and it never returns visitor_id to the client.

create or replace function public.list_video_ideas(p_visitor_id text default null)
returns table (
  id          uuid,
  title       text,
  description text,
  vote_count  int,
  voted       boolean,
  created_at  timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.title, i.description, i.vote_count,
         mine.idea_id is not null as voted,
         i.created_at
    from public.video_ideas i
    left join (
      select v.idea_id
        from public.idea_votes v
       where p_visitor_id is not null and v.visitor_id = p_visitor_id
    ) mine on mine.idea_id = i.id
   order by i.vote_count desc, i.created_at desc, i.id;
$$;

revoke all on function public.list_video_ideas(text) from public;
grant execute on function public.list_video_ideas(text) to anon;

-- 5. Realtime ----------------------------------------------------------------
-- `video_ideas` only. A vote changes vote_count, which surfaces as an UPDATE —
-- unlike every other subscription here, which only ever sees INSERTs.
--
-- idea_votes is deliberately NOT published: subscribers have no SELECT on it so
-- they would receive nothing, and publishing it would put visitor ids on the
-- wire.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'video_ideas'
  ) then
    alter publication supabase_realtime add table public.video_ideas;
  end if;
end $$;
