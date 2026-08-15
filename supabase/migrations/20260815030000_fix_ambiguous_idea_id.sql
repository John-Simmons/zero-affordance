-- Fix 42702 "column reference \"idea_id\" is ambiguous" in the vote functions.
--
-- Both functions declare their result as `returns table (idea_id uuid, ...)`,
-- which creates a PL/pgSQL OUT variable called `idea_id`. Both then wrote
-- `on conflict (idea_id, visitor_id) do nothing`. An ON CONFLICT inference
-- clause holds *expressions* (index inference supports expression indexes), so
-- PL/pgSQL substitutes variables inside it — and there it cannot tell the OUT
-- variable from the column of the same name. Every call raised, which is why
-- voting has never worked against Postgres: the client rolled its optimistic
-- update back and the vote appeared to remove itself.
--
-- The fix removes the inference clause rather than renaming around it. Both
-- functions already delete the visitor's vote row before deciding what to do
-- next, and both hold a `for update` lock on the parent idea for the whole
-- transaction, so no concurrent session can insert the row in between: the
-- delete makes the insert unconditional, and ON CONFLICT was never load-bearing.
-- That also lines the SQL up with the mock adapter, which drops the row and
-- conditionally re-appends it.
--
-- The trap to remember: inside these functions, a bare column name in any
-- expression position is ambiguous with the result columns. Qualify columns
-- (`v.idea_id`) and keep parameters `p_`-prefixed. Column *name* positions —
-- an INSERT column list, the left side of SET — are not substituted and are
-- safe as-is.

create or replace function public.set_idea_vote(
  p_idea_id    uuid,
  p_visitor_id text,
  p_voted      boolean
)
returns table (idea_id uuid, vote_count int, voted boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  if p_visitor_id is null
     or length(btrim(p_visitor_id)) = 0
     or length(p_visitor_id) > 64 then
    raise exception 'invalid visitor id';
  end if;

  if p_voted is null then
    raise exception 'p_voted is required';
  end if;

  -- Serialises concurrent votes on the same idea, so the counter and the vote
  -- rows can never drift apart — and so the delete/insert pair below is atomic
  -- with respect to another session doing the same thing.
  perform 1 from public.video_ideas i where i.id = p_idea_id for update;
  if not found then
    raise exception 'unknown idea %', p_idea_id;
  end if;

  delete from public.idea_votes v
   where v.idea_id = p_idea_id and v.visitor_id = p_visitor_id;

  if p_voted then
    insert into public.idea_votes (idea_id, visitor_id)
         values (p_idea_id, p_visitor_id);
  end if;

  update public.video_ideas i
     set vote_count = (
       select count(*) from public.idea_votes v where v.idea_id = i.id
     )
   where i.id = p_idea_id
  returning i.vote_count into v_count;

  return query select p_idea_id, v_count, p_voted;
end;
$$;

revoke all on function public.set_idea_vote(uuid, text, boolean) from public;
grant execute on function public.set_idea_vote(uuid, text, boolean) to anon;

-- Superseded, but repaired rather than left broken: it is kept for bundles
-- loaded before the switch to set_idea_vote(), and a kept-for-compatibility
-- function that raises on every call is worth nothing. Same one-line change —
-- the delete above it already guarantees there is no row to conflict with.
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

  perform 1 from public.video_ideas i where i.id = p_idea_id for update;
  if not found then
    raise exception 'unknown idea %', p_idea_id;
  end if;

  delete from public.idea_votes v
   where v.idea_id = p_idea_id and v.visitor_id = p_visitor_id;
  get diagnostics v_deleted = row_count;

  if v_deleted = 0 then
    insert into public.idea_votes (idea_id, visitor_id)
         values (p_idea_id, p_visitor_id);
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

comment on function public.toggle_idea_vote(uuid, text) is
  'Superseded by set_idea_vote(). Kept for clients loaded before the switch.';
