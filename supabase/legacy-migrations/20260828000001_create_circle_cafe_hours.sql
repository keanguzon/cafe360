-- ==============================================================================
-- Circle-scoped Cafe Operating Hours (Crowd-sourced per circle)
-- ==============================================================================

create table if not exists public.circle_cafe_hours (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  cafe_id uuid references public.cafes(id) on delete cascade not null,
  day_of_week int not null check (day_of_week between 0 and 6),
  open_time time not null,
  close_time time not null,
  is_closed boolean default false,
  submitted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (group_id, cafe_id, day_of_week)
);

create index if not exists idx_circle_cafe_hours_lookup 
  on public.circle_cafe_hours (group_id, cafe_id);

alter table public.circle_cafe_hours enable row level security;

grant select, insert, update, delete on table public.circle_cafe_hours to authenticated;

-- Circle members can view hours for their circles
drop policy if exists "Circle members can view cafe hours" on public.circle_cafe_hours;
create policy "Circle members can view cafe hours" 
  on public.circle_cafe_hours for select to authenticated
  using (public.is_group_member(group_id));

-- Circle members can add hours
drop policy if exists "Circle members can manage cafe hours" on public.circle_cafe_hours;
create policy "Circle members can manage cafe hours" 
  on public.circle_cafe_hours for insert to authenticated
  with check (
    (select auth.uid()) = submitted_by 
    and public.is_group_member(group_id)
  );

-- Circle members can update hours
drop policy if exists "Circle members can update cafe hours" on public.circle_cafe_hours;
create policy "Circle members can update cafe hours" 
  on public.circle_cafe_hours for update to authenticated
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

-- Submitters can delete cafe hours
drop policy if exists "Submitters can delete cafe hours" on public.circle_cafe_hours;
create policy "Submitters can delete cafe hours" 
  on public.circle_cafe_hours for delete to authenticated
  using ((select auth.uid()) = submitted_by);
