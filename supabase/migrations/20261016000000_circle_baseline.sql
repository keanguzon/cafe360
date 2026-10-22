-- Clean-development baseline. Do not layer over the archived migration history.
create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_url text,
  bio text check (char_length(bio) <= 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.create_profile_for_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare requested text;
begin
  requested := lower(new.raw_user_meta_data ->> 'username');
  insert into public.profiles(id, username, display_name)
  values (new.id,
    case when requested ~ '^[a-z0-9_]{3,24}$' then requested
      else 'user_' || left(replace(new.id::text, '-', ''), 16) end,
    coalesce(nullif(left(trim(new.raw_user_meta_data ->> 'display_name'),80),''), 'Cafe explorer'));
  return new;
end $$;
revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;
create trigger create_profile_after_auth_signup after insert on auth.users
for each row execute function public.create_profile_for_new_user();

create table public.cafes (
  id uuid primary key default gen_random_uuid(),
  provider_place_id text not null unique,
  name text not null check (length(trim(name)) between 1 and 200),
  address text,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  community_rating double precision, -- read-only compatibility; never Circle rating
  community_rating_count integer,
  price_level integer,
  phone text, website text, opening_hours jsonb, categories jsonb,
  timezone text,
  cached_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index cafes_coordinates_idx on public.cafes(lat,lng);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  description text check (length(description) <= 500),
  avatar_url text,
  created_by uuid not null references public.profiles(id),
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','admin','member')),
  joined_at timestamptz not null default now(),
  primary key(group_id,user_id)
);
create index group_members_user_idx on public.group_members(user_id);

-- SECURITY DEFINER avoids recursive membership policies. No caller-selected actor.
create function public.is_group_member(p_group_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid())
$$;
revoke all on function public.is_group_member(uuid) from public, anon;
grant execute on function public.is_group_member(uuid) to authenticated;

create function public.create_circle(p_name text, p_description text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); circle_id uuid; code text; alphabet text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; bytes bytea; n integer;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 80 or length(p_description)>500 then
    raise exception 'Invalid Circle details' using errcode='22023'; end if;
  for attempt in 1..20 loop
    code := '';
    for n in 0..5 loop
      loop
        bytes := extensions.gen_random_bytes(1);
        exit when get_byte(bytes,0)<252;
      end loop;
      code := code || substr(alphabet, (get_byte(bytes,0) % 36)+1, 1);
    end loop;
    begin
      insert into public.groups(name,description,created_by,invite_code)
      values(trim(p_name),nullif(trim(p_description),''),actor,code) returning id into circle_id;
      exit;
    exception when unique_violation then
      if attempt=20 then raise; end if;
    end;
  end loop;
  insert into public.group_members(group_id,user_id,role) values(circle_id,actor,'owner');
  return jsonb_build_object('groupId',circle_id,'inviteCode',code);
end $$;
revoke all on function public.create_circle(text,text) from public, anon;
grant execute on function public.create_circle(text,text) to authenticated;

create function public.preview_circle_invite(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_code is null or upper(trim(p_code)) !~ '^[A-Z0-9]{6}$' then return null; end if;
  select jsonb_build_object('name',g.name,'memberCount',count(m.user_id)) into result
  from public.groups g left join public.group_members m on m.group_id=g.id
  where g.invite_code=upper(trim(p_code)) group by g.id;
  return result;
end $$;
revoke all on function public.preview_circle_invite(text) from public, anon;
grant execute on function public.preview_circle_invite(text) to authenticated;

create function public.join_circle(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); circle_id uuid;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select id into circle_id from public.groups where invite_code=upper(trim(p_code));
  if circle_id is null then raise exception 'Invalid invite code' using errcode='22023'; end if;
  insert into public.group_members(group_id,user_id,role) values(circle_id,actor,'member')
  on conflict(group_id,user_id) do nothing;
  return jsonb_build_object('groupId',circle_id);
end $$;
revoke all on function public.join_circle(text) from public, anon;
grant execute on function public.join_circle(text) to authenticated;

create function public.delete_circle(p_group_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  delete from public.groups where id=p_group_id and created_by=auth.uid();
  get diagnostics affected = row_count;
  if affected<>1 then raise exception 'Circle owner required' using errcode='42501'; end if;
  return jsonb_build_object('deleted',true);
end $$;
revoke all on function public.delete_circle(uuid) from public, anon;
grant execute on function public.delete_circle(uuid) to authenticated;

create function public.leave_circle(p_group_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if exists(select 1 from public.groups where id=p_group_id and created_by=auth.uid()) then
    raise exception 'Circle owner must delete the Circle' using errcode='42501'; end if;
  delete from public.group_members where group_id=p_group_id and user_id=auth.uid() and role<>'owner';
  get diagnostics affected = row_count;
  if affected<>1 then raise exception 'Circle membership required' using errcode='42501'; end if;
  delete from public.cafe_interests where group_id=p_group_id and user_id=auth.uid();
  return jsonb_build_object('left',true);
end $$;
revoke all on function public.leave_circle(uuid) from public, anon;
grant execute on function public.leave_circle(uuid) to authenticated;

create table public.saved_cafes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  collection text not null default 'Favorites', notes text,
  created_at timestamptz not null default now(),
  unique(user_id,cafe_id,collection)
);
create index saved_cafes_user_idx on public.saved_cafes(user_id,created_at desc);
create table public.group_saved_cafes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  saved_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(group_id,cafe_id)
);
create table public.cafe_interests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(group_id,cafe_id,user_id)
);
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  cafe_id uuid not null references public.cafes(id),
  created_by uuid not null references public.profiles(id),
  visited_at date not null,
  rating numeric(2,1) check(rating between 0 and 5),
  notes text check(length(notes)<=1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index visits_group_cafe_idx on public.visits(group_id,cafe_id,visited_at desc);
create table public.visit_participants (
  visit_id uuid not null references public.visits(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  primary key(visit_id,user_id)
);
create table public.visit_photos (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  storage_path text not null unique,
  caption text,
  created_at timestamptz not null default now()
);
create index visit_photos_visit_idx on public.visit_photos(visit_id);
-- Attachment locks survive Circle deletion until storage cleanup removes the bytes.
create table public.photo_attachment_locks (
  storage_path text primary key,
  state text not null default 'attached' check(state in ('attached','deleting')),
  attached_at timestamptz not null default now()
);
create function public.lock_attached_photo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.photo_attachment_locks(storage_path,state) values(new.storage_path,'attached')
  on conflict(storage_path) do update set state='attached'
  where public.photo_attachment_locks.state='attached';
  if not found then raise exception 'Photo is being deleted' using errcode='22023'; end if;
  return new;
end $$;
revoke all on function public.lock_attached_photo() from public,anon,authenticated;
create trigger lock_visit_photo after insert on public.visit_photos
for each row execute function public.lock_attached_photo();
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  type text not null check(type in ('visit','save','photo','rating','join_group','interest')),
  cafe_id uuid references public.cafes(id),
  visit_id uuid references public.visits(id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activities_group_created_idx on public.activities(group_id,created_at desc);
create function public.record_circle_interest_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.activities(group_id,user_id,type,cafe_id)
  values(new.group_id,new.user_id,'interest',new.cafe_id);
  return new;
end $$;
revoke all on function public.record_circle_interest_activity() from public,anon,authenticated;
create function public.record_circle_shared_save_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.activities(group_id,user_id,type,cafe_id)
  values(new.group_id,new.saved_by,'save',new.cafe_id);
  return new;
end $$;
revoke all on function public.record_circle_shared_save_activity() from public,anon,authenticated;
create trigger circle_interest_activity after insert on public.cafe_interests
for each row execute function public.record_circle_interest_activity();
create trigger circle_shared_save_activity after insert on public.group_saved_cafes
for each row execute function public.record_circle_shared_save_activity();
create table public.circle_cafe_hours (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  day_of_week integer not null check(day_of_week between 0 and 6),
  open_time time, close_time time,
  is_closed boolean not null default false,
  timezone text not null default 'Asia/Manila',
  submitted_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(group_id,cafe_id,day_of_week),
  check(is_closed or (open_time is not null and close_time is not null))
);

-- Explicit grants: no direct Circle lifecycle, visit-child or feed writes.
revoke all on public.profiles,public.cafes,public.groups,public.group_members,
 public.saved_cafes,public.group_saved_cafes,public.cafe_interests,public.visits,
 public.visit_participants,public.visit_photos,public.photo_attachment_locks,public.activities,public.circle_cafe_hours
 from public,anon,authenticated;
grant select,insert,update on public.profiles to authenticated;
grant select on public.cafes,public.groups,public.group_members,public.visits,
 public.visit_participants,public.visit_photos,public.activities to authenticated;
grant select,insert,update,delete on public.saved_cafes,public.group_saved_cafes,
 public.cafe_interests,public.circle_cafe_hours to authenticated;
grant all on public.profiles,public.cafes,public.groups,public.group_members,
 public.saved_cafes,public.group_saved_cafes,public.cafe_interests,public.visits,
 public.visit_participants,public.visit_photos,public.activities,public.circle_cafe_hours
 to service_role;
grant all on public.photo_attachment_locks to service_role;

alter table public.profiles enable row level security;
alter table public.cafes enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.saved_cafes enable row level security;
alter table public.group_saved_cafes enable row level security;
alter table public.cafe_interests enable row level security;
alter table public.visits enable row level security;
alter table public.visit_participants enable row level security;
alter table public.visit_photos enable row level security;
alter table public.photo_attachment_locks enable row level security;
alter table public.activities enable row level security;
alter table public.circle_cafe_hours enable row level security;

create policy profiles_read on public.profiles for select to authenticated using(true);
create policy profiles_insert on public.profiles for insert to authenticated with check(id=auth.uid());
create policy profiles_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy cafes_read on public.cafes for select to authenticated using(true);
create policy groups_read on public.groups for select to authenticated using(public.is_group_member(id));
create policy members_read on public.group_members for select to authenticated using(public.is_group_member(group_id));
create policy saved_read on public.saved_cafes for select to authenticated using(user_id=auth.uid());
create policy saved_insert on public.saved_cafes for insert to authenticated with check(user_id=auth.uid());
create policy saved_update on public.saved_cafes for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy saved_delete on public.saved_cafes for delete to authenticated using(user_id=auth.uid());
create policy group_saved_read on public.group_saved_cafes for select to authenticated using(public.is_group_member(group_id));
create policy group_saved_insert on public.group_saved_cafes for insert to authenticated with check(saved_by=auth.uid() and public.is_group_member(group_id));
create policy group_saved_delete on public.group_saved_cafes for delete to authenticated using(saved_by=auth.uid() and public.is_group_member(group_id));
create policy interests_read on public.cafe_interests for select to authenticated using(public.is_group_member(group_id));
create policy interests_insert on public.cafe_interests for insert to authenticated with check(user_id=auth.uid() and public.is_group_member(group_id));
create policy interests_delete on public.cafe_interests for delete to authenticated using(user_id=auth.uid() and public.is_group_member(group_id));
create policy visits_read on public.visits for select to authenticated using(public.is_group_member(group_id));
create policy participants_read on public.visit_participants for select to authenticated using(exists(select 1 from public.visits v where v.id=visit_id and public.is_group_member(v.group_id)));
create policy photos_read on public.visit_photos for select to authenticated using(exists(select 1 from public.visits v where v.id=visit_id and public.is_group_member(v.group_id)));
create policy activities_read on public.activities for select to authenticated using(public.is_group_member(group_id));
create policy hours_read on public.circle_cafe_hours for select to authenticated using(public.is_group_member(group_id));
create policy hours_insert on public.circle_cafe_hours for insert to authenticated with check(submitted_by=auth.uid() and public.is_group_member(group_id));
create policy hours_update on public.circle_cafe_hours for update to authenticated using(public.is_group_member(group_id)) with check(submitted_by=auth.uid() and public.is_group_member(group_id));
create policy hours_delete on public.circle_cafe_hours for delete to authenticated using(public.is_group_member(group_id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('avatars','avatars',true,5242880,array['image/jpeg','image/png','image/webp']),
       ('visit-photos','visit-photos',false,5242880,array['image/jpeg','image/png','image/webp']);

-- Private byte reads consult metadata; unattached objects remain uploader-only.
create function public.can_read_visit_photo(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    exists(select 1 from storage.objects o where o.bucket_id='visit-photos' and o.name=p_path and o.owner_id=auth.uid()::text
      and not exists(select 1 from public.photo_attachment_locks l where l.storage_path=o.name))
    or exists(select 1 from public.visit_photos p join public.visits v on v.id=p.visit_id
      join public.group_members m on m.group_id=v.group_id and m.user_id=auth.uid()
      where p.storage_path=p_path))
$$;
revoke all on function public.can_read_visit_photo(text) from public, anon;
grant execute on function public.can_read_visit_photo(text) to authenticated;

create function public.is_visit_photo_attached(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.photo_attachment_locks where storage_path=p_path)
$$;
revoke all on function public.is_visit_photo_attached(text) from public, anon;
grant execute on function public.is_visit_photo_attached(text) to authenticated;

-- A durable deletion claim wins or loses against the visit attachment claim.
-- Retain deleting paths: an ambiguous Storage API failure must remain retryable.
create function public.claim_temporary_photo_delete(p_path text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); affected integer;
begin
  if actor is null or p_path is null or p_path !~ ('^' || actor::text || '/[0-9a-fA-F-]{36}[.](jpe?g|png|webp)$') then
    raise exception 'Photo owner required' using errcode='42501';
  end if;
  if not exists(select 1 from storage.objects where bucket_id='visit-photos' and name=p_path and owner_id=actor::text) then
    return exists(select 1 from public.photo_attachment_locks where storage_path=p_path and state='deleting');
  end if;
  insert into public.photo_attachment_locks(storage_path,state) values(p_path,'deleting')
  on conflict(storage_path) do update set state='deleting'
  where public.photo_attachment_locks.state='deleting';
  get diagnostics affected = row_count;
  return affected=1;
end $$;
revoke all on function public.claim_temporary_photo_delete(text) from public, anon;
grant execute on function public.claim_temporary_photo_delete(text) to authenticated;

create policy avatar_read on storage.objects for select to public using(bucket_id='avatars');
create policy avatar_insert on storage.objects for insert to authenticated
with check(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy avatar_update on storage.objects for update to authenticated
using(bucket_id='avatars' and owner_id=auth.uid()::text)
with check(bucket_id='avatars' and owner_id=auth.uid()::text and (storage.foldername(name))[1]=auth.uid()::text);
create policy avatar_delete on storage.objects for delete to authenticated using(bucket_id='avatars' and owner_id=auth.uid()::text);
create policy visit_object_insert on storage.objects for insert to authenticated
with check(bucket_id='visit-photos' and owner_id=auth.uid()::text
  and name ~ ('^' || auth.uid()::text || '/[0-9a-fA-F-]{36}[.](jpe?g|png|webp)$'));
create policy visit_object_read on storage.objects for select to authenticated
using(bucket_id='visit-photos' and public.can_read_visit_photo(name));
-- Client Storage DELETE cannot coordinate with visit claims. Server deletion
-- claims the path first, then calls the Storage API with service_role.

-- Atomic visit, participants, photo attachment and one activity event.
create function public.create_circle_visit(p_input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); gid uuid; cid uuid; day_text text; day_value date;
  score numeric; note text; participants jsonb; photos jsonb; child jsonb;
  participant_id uuid; path text; visit_id uuid;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  gid := (p_input ->> 'groupId')::uuid; cid := (p_input ->> 'cafeId')::uuid;
  if not public.is_group_member(gid) then raise exception 'Circle membership required' using errcode='42501'; end if;
  day_text := p_input ->> 'visitedAt';
  if day_text is null or day_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'Invalid visit date' using errcode='22023'; end if;
  day_value := day_text::date;
  if to_char(day_value,'YYYY-MM-DD')<>day_text then raise exception 'Invalid visit date' using errcode='22023'; end if;
  score := nullif(p_input ->> 'rating','')::numeric;
  note := p_input ->> 'notes';
  if (score is not null and (score<0 or score>5 or scale(score)>1)) or length(note)>1000 then
    raise exception 'Invalid visit fields' using errcode='22023'; end if;
  participants := coalesce(p_input -> 'participants','[]'::jsonb);
  photos := coalesce(p_input -> 'photos','[]'::jsonb);
  if jsonb_typeof(participants)<>'array' or jsonb_array_length(participants)>5
    or jsonb_typeof(photos)<>'array' or jsonb_array_length(photos)>5 then
    raise exception 'Too many or invalid visit children' using errcode='22023'; end if;
  if not exists(select 1 from public.cafes where id=cid) then raise exception 'Unknown cafe' using errcode='22023'; end if;
  for child in select value from jsonb_array_elements(participants) loop
    participant_id := trim(both '"' from child::text)::uuid;
    if not exists(select 1 from public.group_members where group_id=gid and user_id=participant_id) then
      raise exception 'Participant is not a Circle member' using errcode='22023'; end if;
  end loop;
  for child in select value from jsonb_array_elements(photos) loop
    path := child ->> 'storagePath';
    if path is null or path !~ ('^' || actor::text || '/[0-9a-fA-F-]{36}[.](jpe?g|png|webp)$')
      or not exists(select 1 from storage.objects where bucket_id='visit-photos' and name=path and owner_id=actor::text)
      or exists(select 1 from public.photo_attachment_locks where storage_path=path) then
      raise exception 'Photo is not attachable' using errcode='22023'; end if;
    insert into public.photo_attachment_locks(storage_path,state) values(path,'attached')
    on conflict do nothing;
    if not found then raise exception 'Photo is not attachable' using errcode='22023'; end if;
  end loop;
  insert into public.visits(group_id,cafe_id,created_by,visited_at,rating,notes)
  values(gid,cid,actor,day_value,score,note) returning id into visit_id;
  for child in select value from jsonb_array_elements(participants) loop
    insert into public.visit_participants(visit_id,user_id)
    values(visit_id,trim(both '"' from child::text)::uuid);
  end loop;
  for child in select value from jsonb_array_elements(photos) loop
    insert into public.visit_photos(visit_id,uploaded_by,storage_path,caption)
    values(visit_id,actor,child ->> 'storagePath',child ->> 'caption');
  end loop;
  insert into public.activities(group_id,user_id,type,cafe_id,visit_id)
  values(gid,actor,'visit',cid,visit_id);
  return jsonb_build_object('visitId',visit_id);
end $$;
revoke all on function public.create_circle_visit(jsonb) from public, anon;
grant execute on function public.create_circle_visit(jsonb) to authenticated;

create function public.circle_cafe_summaries(p_group_id uuid) returns table(
  cafe_id uuid, provider_place_id text, name text, lat double precision, lng double precision,
  interested_members uuid[], visit_count bigint, photo_count bigint, rating numeric, rating_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_group_member(p_group_id) then raise exception 'Circle membership required' using errcode='42501'; end if;
  return query with scoped as (
    select i.cafe_id from public.cafe_interests i where i.group_id=p_group_id
    union select v.cafe_id from public.visits v where v.group_id=p_group_id
    union select s.cafe_id from public.group_saved_cafes s where s.group_id=p_group_id
  )
  select c.id,c.provider_place_id,c.name,c.lat,c.lng,
    coalesce((select array_agg(i.user_id order by i.user_id) from public.cafe_interests i where i.group_id=p_group_id and i.cafe_id=c.id),'{}'::uuid[]),
    (select count(*) from public.visits v where v.group_id=p_group_id and v.cafe_id=c.id),
    (select count(*) from public.visit_photos p join public.visits v on v.id=p.visit_id where v.group_id=p_group_id and v.cafe_id=c.id),
    (select round(avg(v.rating),1) from public.visits v where v.group_id=p_group_id and v.cafe_id=c.id),
    (select count(v.rating) from public.visits v where v.group_id=p_group_id and v.cafe_id=c.id)
  from scoped s join public.cafes c on c.id=s.cafe_id;
end $$;
revoke all on function public.circle_cafe_summaries(uuid) from public, anon;
grant execute on function public.circle_cafe_summaries(uuid) to authenticated;
