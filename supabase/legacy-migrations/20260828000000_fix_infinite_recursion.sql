
-- ==============================================================================
-- FIX: INFINITE RECURSION IN GROUP_MEMBERS RLS
-- ==============================================================================

-- 1. Create a SECURITY DEFINER function to bypass RLS when checking membership.
-- This prevents the infinite recursion caused by group_members querying itself.
create or replace function public.is_group_member(check_group_id uuid)
returns boolean as $$
  select exists (
    select 1 
    from public.group_members 
    where group_id = check_group_id 
    and user_id = auth.uid()
  );
$$ language sql security definer set search_path = public;

-- 2. Drop the broken policy
drop policy if exists "Group members can view members" on public.group_members;

-- 3. Recreate the policy using the secure helper function
create policy "Group members can view members" on public.group_members 
for select to authenticated
using (
  auth.uid() = user_id 
  or public.is_group_member(group_id)
);
