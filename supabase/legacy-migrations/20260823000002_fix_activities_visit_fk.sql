-- Fix: activities.visit_id was declared as a bare UUID with a comment
-- "FK added in Milestone 7 when visits table exists" but the visits
-- migration (20260821000000) never added it. This creates orphaned
-- visit_id references when visits are deleted.
--
-- The implementation plan specifies:
--   visit_id uuid references public.visits(id) on delete cascade

-- First, clean up any orphaned visit_id values that reference
-- non-existent visits (safety net for existing data)
update public.activities
set visit_id = null
where visit_id is not null
  and visit_id not in (select id from public.visits);

-- Now add the FK constraint
alter table public.activities
  add constraint activities_visit_id_fkey
  foreign key (visit_id)
  references public.visits(id)
  on delete cascade;
