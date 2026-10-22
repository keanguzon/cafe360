-- ==============================================================================
-- FIX: CIRCLE INVITE CODES & SECURE JOIN RPC
-- Run this in Supabase SQL Editor to allow anyone with an invite code to join circles
-- ==============================================================================

-- 1. Allow authenticated users to view groups (required for invite code resolution & preview)
drop policy if exists "Group members can view groups" on public.groups;
drop policy if exists "Group members and creators can view groups" on public.groups;
drop policy if exists "Authenticated users can view groups" on public.groups;

create policy "Authenticated users can view groups" on public.groups
  for select to authenticated
  using (true);

-- 2. Secure RPC to join circle by invite code directly (bypasses RLS safely)
create or replace function public.join_group_via_invite_code(code_input text)
returns jsonb as $$
declare
  target_group record;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Not authenticated');
  end if;

  select id, name into target_group 
  from public.groups 
  where lower(invite_code) = lower(trim(code_input));

  if target_group.id is null then
    return jsonb_build_object('success', false, 'error', 'Invalid invite code');
  end if;

  -- Insert membership (idempotent)
  insert into public.group_members (group_id, user_id, role)
  values (target_group.id, current_user_id, 'member')
  on conflict (group_id, user_id) do nothing;

  return jsonb_build_object('success', true, 'groupId', target_group.id, 'groupName', target_group.name);
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.join_group_via_invite_code(text) to authenticated;
