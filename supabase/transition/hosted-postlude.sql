insert into public.profiles(id,username,display_name,avatar_url,bio,created_at,updated_at)
select id,username,display_name,avatar_url,bio,created_at,updated_at
from cafe360_legacy_20261019.profiles;

do $$ begin
  if (select count(*) from public.profiles)<>6
     or exists(select id,username,display_name,avatar_url,bio,created_at,updated_at
       from cafe360_legacy_20261019.profiles
       except select id,username,display_name,avatar_url,bio,created_at,updated_at
       from public.profiles)
     or exists(select id from auth.users except select id from public.profiles) then
    raise exception 'profile preservation check failed';
  end if;
  if (select count(*) from storage.objects where bucket_id='avatars')<>2
     or (select count(*) from storage.objects where bucket_id='visit-photos')<>0
     or not exists(select 1 from storage.buckets where id='visit-photos' and not public
       and file_size_limit=5242880
       and allowed_mime_types=array['image/jpeg','image/png','image/webp']) then
    raise exception 'storage preservation or privacy check failed';
  end if;
  if (select count(*) from pg_policies where schemaname='storage' and tablename='objects')<>6
     or exists(select 1 from pg_policies where schemaname='storage' and tablename='objects'
       and policyname not in ('avatar_read','avatar_insert','avatar_update','avatar_delete',
       'visit_object_insert','visit_object_read')) then
    raise exception 'storage policy replacement check failed';
  end if;
  if not exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass
       and tgname='create_profile_after_auth_signup' and not tgisinternal)
     or to_regclass('public.places_quota_window') is null then
    raise exception 'new schema verification failed';
  end if;
end $$;
commit;
