-- Cafes table (cached from Mapbox Search + user-generated discoveries)
create table public.cafes (
  id uuid primary key default gen_random_uuid(),
  provider_place_id text unique,
  name text not null,
  address text,
  lat double precision not null,
  lng double precision not null,
  community_rating double precision default 4.5,
  community_rating_count int default 0,
  price_level int default 2,
  phone text,
  website text,
  opening_hours jsonb,
  categories jsonb,
  cached_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Indexes for fast geospatial and place lookups
create index idx_cafes_provider_place_id on public.cafes (provider_place_id);
create index idx_cafes_lat_lng on public.cafes (lat, lng);

alter table public.cafes enable row level security;

grant select, insert, update on table public.cafes to authenticated;
grant select on table public.cafes to anon;

create policy "Cafes are viewable by everyone"
  on public.cafes for select
  to public
  using (true);

create policy "Authenticated users can insert cafes"
  on public.cafes for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update cafes"
  on public.cafes for update
  to authenticated
  using (true)
  with check (true);
