-- Make casting a vote idempotent.
--
-- toggle_idea_vote() flips whatever it finds: vote row present → delete, absent
-- → insert. That makes the operation's result depend on how many times the
-- request arrives rather than on what the person asked for, and a duplicate
-- delivery of ONE tap silently cancels the vote. Duplicates are not
-- hypothetical: browsers re-send a POST on their own when a pooled keep-alive
-- connection is closed before the response comes back (common on mobile
-- radios), and a double tap does the same thing from the other end.
--
-- set_idea_vote() takes the intended state instead, so the second delivery of
-- the same call is a no-op. A deliberate second tap still un-votes — the client
-- sends `p_voted => false` for it — but "did this request arrive twice?" stops
-- being a question the vote count can answer.
--
-- Everything else is carried over from toggle_idea_vote() unchanged: the same
-- visitor-id validation, the same `for update` lock that serialises concurrent
-- toggles on one idea, and the same recount-rather-than-increment update that
-- lets vote_count self-correct.

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

  perform 1 from public.video_ideas i where i.id = p_idea_id for update;
  if not found then
    raise exception 'unknown idea %', p_idea_id;
  end if;

  if p_voted then
    insert into public.idea_votes (idea_id, visitor_id)
         values (p_idea_id, p_visitor_id)
    on conflict (idea_id, visitor_id) do nothing;
  else
    delete from public.idea_votes v
     where v.idea_id = p_idea_id and v.visitor_id = p_visitor_id;
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

-- toggle_idea_vote() is superseded but deliberately NOT dropped: a bundle
-- loaded before this deploy still calls it, and it keeps working correctly for
-- as long as it is the only caller of a given vote row. Drop it in a later
-- migration once no client can still be running that code.
comment on function public.toggle_idea_vote(uuid, text) is
  'Superseded by set_idea_vote(). Kept for clients loaded before the switch.';
