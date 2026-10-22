-- ============================================================
-- Milestone 7: Visits & Memories Tables
-- ============================================================

-- 1. Visits
create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid references public.cafes(id) on delete cascade not null,
  created_by uuid references public.profiles(id) on delete cascade not null,
  visited_at date not null,
  rating decimal(2,1) check (rating >= 0 and rating <= 5),
  notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists idx_visits_cafe on public.visits (cafe_id);
create index if not exists idx_visits_user on public.visits (created_by);
create index if not exists idx_visits_date on public.visits (visited_at desc);

alter table public.visits enable row level security;

grant select, insert, update on table public.visits to authenticated;

create policy "Visits are viewable by participants and friends"
  on public.visits for select
  to authenticated
  using (
    created_by = (select auth.uid())
    or exists (
      select 1 from public.visit_participants vp
      where vp.visit_id = visits.id and vp.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
      and (
        (f.requester_id = (select auth.uid()) and f.addressee_id = visits.created_by)
        or (f.addressee_id = (select auth.uid()) and f.requester_id = visits.created_by)
      )
    )
  );

create policy "Users can insert own visits"
  on public.visits for insert
  to authenticated
  with check (created_by = (select auth.uid()));

create policy "Creators can update own visits"
  on public.visits for update
  to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));


-- 2. Visit participants
create table if not exists public.visit_participants (
  visit_id uuid references public.visits(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  primary key (visit_id, user_id)
);

alter table public.visit_participants enable row level security;

grant select, insert on table public.visit_participants to authenticated;

create policy "Visit participants can view co-participants"
  on public.visit_participants for select
  to authenticated
  using (
    exists (
      select 1 from public.visits v
      where v.id = visit_participants.visit_id
      and (
        v.created_by = (select auth.uid())
        or exists (
          select 1 from public.visit_participants vp
          where vp.visit_id = v.id and vp.user_id = (select auth.uid())
        )
        or exists (
          select 1 from public.friendships f
          where f.status = 'accepted'
          and (
            (f.requester_id = (select auth.uid()) and f.addressee_id = v.created_by)
            or (f.addressee_id = (select auth.uid()) and f.requester_id = v.created_by)
          )
        )
      )
    )
  );

create policy "Visit creators can add participants"
  on public.visit_participants for insert
  to authenticated
  with check (
    exists (
      select 1 from public.visits v
      where v.id = visit_participants.visit_id
      and v.created_by = (select auth.uid())
    )
  );


-- 3. Visit photos
create table if not exists public.visit_photos (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid references public.visits(id) on delete cascade not null,
  uploaded_by uuid references public.profiles(id) on delete cascade not null,
  storage_path text not null,
  caption text,
  created_at timestamptz default now() not null
);

create index if not exists idx_visit_photos_visit on public.visit_photos (visit_id);

alter table public.visit_photos enable row level security;

grant select, insert on table public.visit_photos to authenticated;

create policy "Visit photos are viewable by participants and friends"
  on public.visit_photos for select
  to authenticated
  using (
    exists (
      select 1 from public.visits v
      where v.id = visit_photos.visit_id
      and (
        v.created_by = (select auth.uid())
        or exists (
          select 1 from public.visit_participants vp
          where vp.visit_id = v.id and vp.user_id = (select auth.uid())
        )
        or exists (
          select 1 from public.friendships f
          where f.status = 'accepted'
          and (
            (f.requester_id = (select auth.uid()) and f.addressee_id = v.created_by)
            or (f.addressee_id = (select auth.uid()) and f.requester_id = v.created_by)
          )
        )
      )
    )
  );

create policy "Visit participants can insert photos"
  on public.visit_photos for insert
  to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and exists (
      select 1 from public.visits v
      where v.id = visit_photos.visit_id
      and (
        v.created_by = (select auth.uid())
        or exists (
          select 1 from public.visit_participants vp
          where vp.visit_id = v.id and vp.user_id = (select auth.uid())
        )
      )
    )
  );


-- 4. Activity Triggers for Visits and Photos
create or replace function create_visit_activity()
returns trigger as $$
begin
  insert into public.activities (id, user_id, type, cafe_id, visit_id, created_at)
  values (gen_random_uuid(), NEW.created_by, 'visit', NEW.cafe_id, NEW.id, now());
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_visit_created on public.visits;
create trigger on_visit_created
  after insert on public.visits
  for each row execute function create_visit_activity();


create or replace function create_photo_activity()
returns trigger as $$
declare
  v_cafe_id uuid;
begin
  select cafe_id into v_cafe_id from public.visits where id = NEW.visit_id;
  insert into public.activities (id, user_id, type, cafe_id, visit_id, created_at)
  values (gen_random_uuid(), NEW.uploaded_by, 'photo', v_cafe_id, NEW.visit_id, now());
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_photo_uploaded on public.visit_photos;
create trigger on_photo_uploaded
  after insert on public.visit_photos
  for each row execute function create_photo_activity();


-- 5. Storage Buckets (5MB limit)
insert into storage.buckets (id, name, public, file_size_limit)
values ('visit-photos', 'visit-photos', true, 5242880)
on conflict (id) do update set file_size_limit = 5242880, public = true;

create policy "Users can upload visit photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'visit-photos' and (select auth.uid())::text = (storage.foldername(name))[1]);

create policy "Visit photos are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'visit-photos');
