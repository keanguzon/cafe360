-- ==============================================================================
-- CAFE360 BETA: Life360 Real-Time Geolocation & Circle-Centric Schema
-- ==============================================================================

-- 1. Create user_locations table for live GPS & Battery tracking
create table if not exists public.user_locations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  heading double precision,
  speed double precision,
  battery_level int,
  is_charging boolean default false,
  place_name text,
  updated_at timestamptz not null default now()
);

-- 2. Add group_id to visits for Circle-isolated cafe reviews & visits
alter table public.visits 
  add column if not exists group_id uuid references public.groups(id) on delete cascade;

create index if not exists idx_visits_group_id on public.visits(group_id);
create index if not exists idx_user_locations_updated_at on public.user_locations(updated_at);

-- 3. Security Definer helper: Checks if current user shares ANY circle with target user
create or replace function public.shares_circle_with(target_user_id uuid)
returns boolean as $$
  select exists (
    select 1 
    from public.group_members gm1
    join public.group_members gm2 on gm1.group_id = gm2.group_id
    where gm1.user_id = auth.uid() 
      and gm2.user_id = target_user_id
  );
$$ language sql security definer set search_path = public;

-- 4. RLS for user_locations
alter table public.user_locations enable row level security;

drop policy if exists "Users can update their own location" on public.user_locations;
create policy "Users can update their own location" on public.user_locations
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can view circle members locations" on public.user_locations;
create policy "Users can view circle members locations" on public.user_locations
  for select to authenticated
  using (
    auth.uid() = user_id 
    or public.shares_circle_with(user_id)
  );

-- 5. Enable Supabase Realtime for user_locations
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_locations'
  ) then
    alter publication supabase_realtime add table public.user_locations;
  end if;
exception
  when undefined_object then null;
end $$;
