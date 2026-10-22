-- Hangout plans
create table if not exists public.hangout_plans (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  created_by uuid references public.profiles(id) on delete cascade not null,
  title text,
  status text check (status in ('planning', 'decided', 'completed', 'cancelled')) default 'planning' not null,
  decided_cafe_id uuid references public.cafes(id) on delete set null,
  max_distance_km decimal,
  max_budget int,
  preferred_date date,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Hangout plan café options
create table if not exists public.hangout_options (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.hangout_plans(id) on delete cascade not null,
  cafe_id uuid references public.cafes(id) on delete cascade not null,
  suggested_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now() not null
);

-- Optional votes on hangout options
create table if not exists public.hangout_votes (
  option_id uuid references public.hangout_options(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  vote boolean default true not null,
  primary key (option_id, user_id)
);

-- Hangout plans: group members only
alter table public.hangout_plans enable row level security;

create policy "Group members can view hangout plans"
  on public.hangout_plans for select
  to authenticated
  using (
    exists (
      select 1 from public.group_members
      where group_members.group_id = hangout_plans.group_id
      and group_members.user_id = (select auth.uid())
    )
  );

create policy "Group members can create hangout plans"
  on public.hangout_plans for insert
  to authenticated
  with check (
    (select auth.uid()) = created_by
    and exists (
      select 1 from public.group_members
      where group_members.group_id = hangout_plans.group_id
      and group_members.user_id = (select auth.uid())
    )
  );

create policy "Plan creators can update hangout plans"
  on public.hangout_plans for update
  to authenticated
  using ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);

-- Hangout options: group members only
alter table public.hangout_options enable row level security;

create policy "Group members can view hangout options"
  on public.hangout_options for select
  to authenticated
  using (
    exists (
      select 1 from public.hangout_plans hp
      join public.group_members gm on gm.group_id = hp.group_id
      where hp.id = hangout_options.plan_id
      and gm.user_id = (select auth.uid())
    )
  );

create policy "Group members can suggest hangout options"
  on public.hangout_options for insert
  to authenticated
  with check (
    exists (
      select 1 from public.hangout_plans hp
      join public.group_members gm on gm.group_id = hp.group_id
      where hp.id = hangout_options.plan_id
      and gm.user_id = (select auth.uid())
    )
  );

-- Hangout votes: group members only
alter table public.hangout_votes enable row level security;

create policy "Group members can view votes"
  on public.hangout_votes for select
  to authenticated
  using (
    exists (
      select 1 from public.hangout_options ho
      join public.hangout_plans hp on hp.id = ho.plan_id
      join public.group_members gm on gm.group_id = hp.group_id
      where ho.id = hangout_votes.option_id
      and gm.user_id = (select auth.uid())
    )
  );

create policy "Group members can cast votes"
  on public.hangout_votes for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.hangout_options ho
      join public.hangout_plans hp on hp.id = ho.plan_id
      join public.group_members gm on gm.group_id = hp.group_id
      where ho.id = hangout_votes.option_id
      and gm.user_id = (select auth.uid())
    )
  );
