-- Fix groups SELECT policy to allow creator to see the group immediately
drop policy if exists "Group members can view groups" on public.groups;
drop policy if exists "Group members and creators can view groups" on public.groups;

create policy "Group members and creators can view groups" on public.groups for select to authenticated
  using (
    auth.uid() = created_by 
    or public.is_group_member(id)
  );

-- Fix group_members SELECT policy to allow users to see their own membership immediately
drop policy if exists "Group members can view members" on public.group_members;

create policy "Group members can view members" on public.group_members for select to authenticated
  using (
    auth.uid() = user_id 
    or public.is_group_member(group_id)
  );
