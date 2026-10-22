begin;
-- Offline prepared transition. Run only after a reviewed backup and write pause.
set local lock_timeout = '5s';
set local statement_timeout = '2min';
do $$ begin
  if to_regnamespace('cafe360_legacy_20261019') is not null then
    raise exception 'archive schema already exists';
  end if;
end $$;
lock table auth.users, storage.objects, storage.buckets in share row exclusive mode;
lock table public.activities, public.cafe_interests, public.cafes,
  public.circle_cafe_hours, public.group_members, public.group_saved_cafes,
  public.groups, public.hangout_options, public.hangout_plans, public.hangout_votes,
  public.profiles, public.saved_cafes, public.visit_participants, public.visit_photos,
  public.visits in share row exclusive mode;

do $$
declare
  old_tables text[] := array['activities','cafe_interests','cafes','circle_cafe_hours',
    'group_members','group_saved_cafes','groups','hangout_options','hangout_plans',
    'hangout_votes','profiles','saved_cafes','visit_participants','visit_photos','visits'];
  old_functions text[] := array['create_join_group_activity()','create_photo_activity()',
    'create_profile_for_new_user()','create_save_activity()','create_visit_activity()',
    'is_group_admin(uuid)','is_group_member(uuid)','is_visit_participant(uuid)',
    'join_group_via_invite_code(text)','set_profile_updated_at()'];
  old_storage_policies text[] := array['Public avatar reads','Users can delete their own avatar',
    'Users can update their own avatar','Users can upload their own avatar',
    'Users can upload visit photos','Visit photos are publicly readable'];
begin
  if to_regnamespace('cafe360_legacy_20261019') is not null then
    raise exception 'archive schema already exists';
  end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind in ('r','p')) <> 15
     or exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind in ('r','p') and not c.relname=any(old_tables)) then
    raise exception 'unexpected public table inventory';
  end if;
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind in ('v','m','f')) then
    raise exception 'unexpected public view or foreign table';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.prokind in ('f','p')) <> 10
     or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.prokind in ('f','p')
      and not (p.proname || '(' || oidvectortypes(p.proargtypes) || ')')=any(old_functions)) then
    raise exception 'unexpected public routine inventory';
  end if;
  if (select count(*) from pg_policies where schemaname='storage' and tablename='objects') <> 6
     or exists(select 1 from pg_policies where schemaname='storage' and tablename='objects'
       and not policyname=any(old_storage_policies)) then
    raise exception 'unexpected storage object policy inventory';
  end if;
  if (select count(*) from pg_trigger t where t.tgrelid='auth.users'::regclass and not t.tgisinternal) <> 1
     or not exists(select 1 from pg_trigger t where t.tgrelid='auth.users'::regclass
       and not t.tgisinternal and t.tgname='create_profile_after_auth_signup') then
    raise exception 'unexpected auth trigger inventory';
  end if;
  if exists(select 1 from pg_constraint k join pg_class referenced on referenced.oid=k.confrelid
      join pg_namespace rn on rn.oid=referenced.relnamespace
      join pg_class dependent on dependent.oid=k.conrelid
      join pg_namespace dn on dn.oid=dependent.relnamespace
      where k.contype='f' and rn.nspname='public' and dn.nspname<>'public') then
    raise exception 'external foreign key depends on legacy public tables';
  end if;
  if exists(select 1 from pg_depend d
      join pg_rewrite r on r.oid=d.objid
      join pg_class v on v.oid=r.ev_class
      join pg_namespace vn on vn.oid=v.relnamespace
      join pg_class referenced on referenced.oid=d.refobjid
      join pg_namespace rn on rn.oid=referenced.relnamespace
      where d.classid='pg_rewrite'::regclass and rn.nspname='public'
        and vn.nspname<>'public' and v.relkind in ('v','m')) then
    raise exception 'external view depends on legacy public tables';
  end if;
  if exists(select 1 from pg_publication where puballtables)
     or exists(select 1 from pg_publication_tables where schemaname='public') then
    raise exception 'unexpected publication includes legacy public tables';
  end if;
  if (select count(*) from auth.users) <> 6 or (select count(*) from public.profiles) <> 6
     or exists(select 1 from auth.users u full join public.profiles p on p.id=u.id
       where u.id is null or p.id is null) then
    raise exception 'auth/profile identity inventory changed';
  end if;
  if exists(select 1 from public.profiles where username is null
      or username !~ '^[a-z0-9_]{3,24}$'
      or display_name is null or char_length(display_name) not between 1 and 80
      or char_length(bio)>240) then
    raise exception 'legacy profiles violate new baseline checks';
  end if;
  if (select count(*) from public.activities)<>14
     or (select count(*) from public.cafe_interests)<>3
     or (select count(*) from public.cafes)<>10
     or (select count(*) from public.circle_cafe_hours)<>0
     or (select count(*) from public.group_members)<>6
     or (select count(*) from public.group_saved_cafes)<>0
     or (select count(*) from public.groups)<>5
     or (select count(*) from public.hangout_options)<>0
     or (select count(*) from public.hangout_plans)<>0
     or (select count(*) from public.hangout_votes)<>0
     or (select count(*) from public.saved_cafes)<>4
     or (select count(*) from public.visit_participants)<>0
     or (select count(*) from public.visit_photos)<>0
     or (select count(*) from public.visits)<>1 then
    raise exception 'legacy data counts changed';
  end if;
  if (select count(*) from storage.buckets)<>2
     or not exists(select 1 from storage.buckets where id='avatars' and name='avatars'
       and public and file_size_limit=5242880
       and allowed_mime_types=array['image/jpeg','image/png','image/webp'])
     or not exists(select 1 from storage.buckets where id='visit-photos' and name='visit-photos'
       and public and file_size_limit=10485760 and allowed_mime_types is null) then
    raise exception 'storage bucket configuration changed';
  end if;
  if (select count(*) from storage.objects where bucket_id='avatars')<>2
     or (select count(*) from storage.objects where bucket_id='visit-photos')<>0
     or (select count(*) from storage.objects)<>2 then
    raise exception 'storage object inventory changed';
  end if;
end $$;

-- DDL locks and this single transaction prevent a partially visible cutover.
create schema cafe360_legacy_20261019;
revoke all on schema cafe360_legacy_20261019 from public, anon, authenticated, service_role;
drop trigger create_profile_after_auth_signup on auth.users;
drop policy "Public avatar reads" on storage.objects;
drop policy "Users can delete their own avatar" on storage.objects;
drop policy "Users can update their own avatar" on storage.objects;
drop policy "Users can upload their own avatar" on storage.objects;
drop policy "Users can upload visit photos" on storage.objects;
drop policy "Visit photos are publicly readable" on storage.objects;

alter table public.activities set schema cafe360_legacy_20261019;
alter table public.cafe_interests set schema cafe360_legacy_20261019;
alter table public.cafes set schema cafe360_legacy_20261019;
alter table public.circle_cafe_hours set schema cafe360_legacy_20261019;
alter table public.group_members set schema cafe360_legacy_20261019;
alter table public.group_saved_cafes set schema cafe360_legacy_20261019;
alter table public.groups set schema cafe360_legacy_20261019;
alter table public.hangout_options set schema cafe360_legacy_20261019;
alter table public.hangout_plans set schema cafe360_legacy_20261019;
alter table public.hangout_votes set schema cafe360_legacy_20261019;
alter table public.profiles set schema cafe360_legacy_20261019;
alter table public.saved_cafes set schema cafe360_legacy_20261019;
alter table public.visit_participants set schema cafe360_legacy_20261019;
alter table public.visit_photos set schema cafe360_legacy_20261019;
alter table public.visits set schema cafe360_legacy_20261019;

alter function public.create_join_group_activity() set schema cafe360_legacy_20261019;
alter function public.create_photo_activity() set schema cafe360_legacy_20261019;
alter function public.create_profile_for_new_user() set schema cafe360_legacy_20261019;
alter function public.create_save_activity() set schema cafe360_legacy_20261019;
alter function public.create_visit_activity() set schema cafe360_legacy_20261019;
alter function public.is_group_admin(uuid) set schema cafe360_legacy_20261019;
alter function public.is_group_member(uuid) set schema cafe360_legacy_20261019;
alter function public.is_visit_participant(uuid) set schema cafe360_legacy_20261019;
alter function public.join_group_via_invite_code(text) set schema cafe360_legacy_20261019;
alter function public.set_profile_updated_at() set schema cafe360_legacy_20261019;

do $$ declare t text; begin
  foreach t in array array['activities','cafe_interests','cafes','circle_cafe_hours',
    'group_members','group_saved_cafes','groups','hangout_options','hangout_plans',
    'hangout_votes','profiles','saved_cafes','visit_participants','visit_photos','visits'] loop
    execute format('alter table cafe360_legacy_20261019.%I disable trigger user',t);
  end loop;
end $$;
revoke all on all tables in schema cafe360_legacy_20261019 from public, anon, authenticated, service_role;
revoke all on all sequences in schema cafe360_legacy_20261019 from public, anon, authenticated, service_role;
revoke all on all functions in schema cafe360_legacy_20261019 from public, anon, authenticated, service_role;
