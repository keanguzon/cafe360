-- ============================================================
-- Milestone 6: Social Tables (Friendships, Groups, Activities)
-- ============================================================

-- 1. Friendships (bidirectional)
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references public.profiles(id) on delete cascade not null,
  addressee_id uuid references public.profiles(id) on delete cascade not null,
  status text check (status in ('pending', 'accepted', 'declined', 'blocked')) default 'pending' not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (requester_id, addressee_id)
);

create index if not exists idx_friendships_addressee on public.friendships (addressee_id) where status = 'pending';
create index if not exists idx_friendships_pair on public.friendships (requester_id, addressee_id);

alter table public.friendships enable row level security;

grant select, insert, update, delete on table public.friendships to authenticated;

create policy "Users can view own friendships"
  on public.friendships for select
  to authenticated
  using (
    (select auth.uid()) = requester_id
    or (select auth.uid()) = addressee_id
  );

create policy "Users can send friend requests"
  on public.friendships for insert
  to authenticated
  with check ((select auth.uid()) = requester_id);

create policy "Addressees can update friendship status"
  on public.friendships for update
  to authenticated
  using ((select auth.uid()) = addressee_id)
  with check ((select auth.uid()) = addressee_id);

create policy "Users can delete own friendships"
  on public.friendships for delete
  to authenticated
  using (
    (select auth.uid()) = requester_id
    or (select auth.uid()) = addressee_id
  );

-- 2. Groups
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  avatar_url text,
  created_by uuid references public.profiles(id) on delete set null,
  invite_code text unique default encode(gen_random_bytes(6), 'hex'),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.groups enable row level security;

grant select, insert, update on table public.groups to authenticated;

create policy "Group members can view groups"
  on public.groups for select
  to authenticated
  using (
    exists (
      select 1 from public.group_members
      where group_members.group_id = groups.id
      and group_members.user_id = (select auth.uid())
    )
  );

create policy "Authenticated users can create groups"
  on public.groups for insert
  to authenticated
  with check ((select auth.uid()) = created_by);

create policy "Group owners and admins can update groups"
  on public.groups for update
  to authenticated
  using (
    exists (
      select 1 from public.group_members
      where group_members.group_id = groups.id
      and group_members.user_id = (select auth.uid())
      and group_members.role in ('owner', 'admin')
    )
  );

-- 3. Group Members
create table if not exists public.group_members (
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text check (role in ('owner', 'admin', 'member')) default 'member' not null,
  joined_at timestamptz default now() not null,
  primary key (group_id, user_id)
);

create index if not exists idx_group_members_user on public.group_members (user_id);

alter table public.group_members enable row level security;

grant select, insert, delete on table public.group_members to authenticated;

create policy "Group members can view members"
  on public.group_members for select
  to authenticated
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_members.group_id
      and gm.user_id = (select auth.uid())
    )
  );

create policy "Users can join groups via invite"
  on public.group_members for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can leave groups"
  on public.group_members for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- 4. Group Saved Cafés
create table if not exists public.group_saved_cafes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  cafe_id uuid references public.cafes(id) on delete cascade not null,
  saved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now() not null,
  unique (group_id, cafe_id)
);

alter table public.group_saved_cafes enable row level security;

grant select, insert, delete on table public.group_saved_cafes to authenticated;

create policy "Group members can view group saved cafes"
  on public.group_saved_cafes for select
  to authenticated
  using (
    exists (
      select 1 from public.group_members
      where group_members.group_id = group_saved_cafes.group_id
      and group_members.user_id = (select auth.uid())
    )
  );

create policy "Group members can save cafes to group"
  on public.group_saved_cafes for insert
  to authenticated
  with check (
    (select auth.uid()) = saved_by
    and exists (
      select 1 from public.group_members
      where group_members.group_id = group_saved_cafes.group_id
      and group_members.user_id = (select auth.uid())
    )
  );

create policy "Group members can remove group saved cafes"
  on public.group_saved_cafes for delete
  to authenticated
  using (
    exists (
      select 1 from public.group_members
      where group_members.group_id = group_saved_cafes.group_id
      and group_members.user_id = (select auth.uid())
    )
  );

-- 5. Activities (denormalized feed)
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text check (type in ('visit', 'save', 'photo', 'rating', 'join_group')) not null,
  cafe_id uuid references public.cafes(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  visit_id uuid,  -- FK added in Milestone 7 when visits table exists
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now() not null
);

create index if not exists idx_activities_user on public.activities (user_id, created_at desc);
create index if not exists idx_activities_group on public.activities (created_at desc) where group_id is not null;

alter table public.activities enable row level security;

grant select, insert on table public.activities to authenticated;

create policy "Users can view own and friend activities"
  on public.activities for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
      and (
        (f.requester_id = (select auth.uid()) and f.addressee_id = activities.user_id)
        or (f.addressee_id = (select auth.uid()) and f.requester_id = activities.user_id)
      )
    )
  );

create policy "Users can insert own activities"
  on public.activities for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- 6. Triggers — auto-create activity on café save
create or replace function public.create_save_activity()
returns trigger as $$
begin
  insert into public.activities (id, user_id, type, cafe_id, created_at)
  values (gen_random_uuid(), NEW.user_id, 'save', NEW.cafe_id, now());
  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_cafe_saved
  after insert on public.saved_cafes
  for each row execute function public.create_save_activity();

-- 7. Trigger — auto-create activity on group join
create or replace function public.create_join_group_activity()
returns trigger as $$
begin
  insert into public.activities (id, user_id, type, group_id, created_at)
  values (gen_random_uuid(), NEW.user_id, 'join_group', NEW.group_id, now());
  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_group_joined
  after insert on public.group_members
  for each row execute function public.create_join_group_activity();

-- 8. Also add "friends can see saved cafes" policy to saved_cafes
create policy "Users can view friends saves for same cafe"
  on public.saved_cafes for select
  to authenticated
  using (
    exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
      and (
        (f.requester_id = (select auth.uid()) and f.addressee_id = saved_cafes.user_id)
        or (f.addressee_id = (select auth.uid()) and f.requester_id = saved_cafes.user_id)
      )
    )
  );
