-- Saved Cafes (Collections & Favorites)
create table if not exists public.saved_cafes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  cafe_id uuid references public.cafes(id) on delete cascade not null,
  collection text default 'Favorites' not null,
  notes text,
  created_at timestamptz default now() not null,
  unique (user_id, cafe_id, collection)
);

-- Performance indexes
create index if not exists idx_saved_cafes_user on public.saved_cafes (user_id);
create index if not exists idx_saved_cafes_cafe on public.saved_cafes (cafe_id);
create index if not exists idx_saved_cafes_collection on public.saved_cafes (user_id, collection);
create index if not exists idx_saved_cafes_created_at on public.saved_cafes (created_at desc);

-- Row Level Security
alter table public.saved_cafes enable row level security;

grant select, insert, update, delete on table public.saved_cafes to authenticated;

create policy "Users can view own saved cafes"
  on public.saved_cafes for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can save cafes"
  on public.saved_cafes for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own saved cafes"
  on public.saved_cafes for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can unsave cafes"
  on public.saved_cafes for delete
  to authenticated
  using ((select auth.uid()) = user_id);
