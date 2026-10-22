-- Fix: cafes.community_rating defaulted to 4.5, making unrated cafes
-- appear as 4.5-star rated. The implementation plan says this column
-- should be nullable with no default, representing "no community ratings yet".
-- Task log M4 confirms: "formatted unrated discoveries with honest 'New' badge".

-- Remove the misleading default
alter table public.cafes
  alter column community_rating drop default;

-- Set all cafes with 0 community ratings to NULL (they were never really rated)
update public.cafes
set community_rating = null
where community_rating_count = 0;

-- Also add the missing UPDATE RLS policy for hangout_votes
-- (castHangoutVoteAction uses .upsert() which needs UPDATE access)
create policy "Users can update own votes"
  on public.hangout_votes for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
