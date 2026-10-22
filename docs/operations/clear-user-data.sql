-- Cafe360 full user-data reset for a human operator to run manually.
-- Select the intended Supabase project, review this file, then run the whole
-- script in the Supabase SQL Editor with an administrator connection.
--
-- Deletes every Auth account and all active and archived profiles, Circles,
-- memberships, saves, visits, ratings, interests, activity, photo metadata,
-- attachment locks, and Places quota rows. It preserves café catalog rows,
-- schemas, functions, triggers, policies, and Storage bucket configuration.
--
-- Storage bytes cannot be deleted with SQL. Empty every Storage bucket through
-- the Supabase Storage API or Dashboard first. This script aborts and rolls
-- back if storage.objects contains even one row. It never deletes object rows.
-- Review any unexpected application table before running; the preflight will
-- stop rather than silently leave that table's data behind.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Block account creation and Storage uploads while the reset transaction runs.
lock table auth.users, storage.objects in share row exclusive mode;

do $reset$
declare
  user_data_tables text[] := array[
    'profiles', 'groups', 'group_members', 'saved_cafes',
    'group_saved_cafes', 'cafe_interests', 'visits', 'visit_participants',
    'visit_photos', 'photo_attachment_locks', 'activities',
    'circle_cafe_hours', 'places_quota_window', 'hangout_votes',
    'hangout_options', 'hangout_plans'
  ];
  target_list text;
  catalog_before bigint := 0;
  catalog_after bigint := 0;
  catalog_table_count integer := 0;
  remaining bigint;
  t record;
begin
  -- Stop before any data changes until actual uploaded bytes have been removed.
  if exists (select 1 from storage.objects) then
    raise exception
      'STOP: storage.objects is not empty. Remove uploaded files through Supabase Storage, then rerun.';
  end if;

  if to_regclass('public.cafes') is null then
    raise exception 'STOP: public.cafes is missing; review the current schema before resetting.';
  end if;

  -- This explicit inventory covers the active schema and the archived
  -- 2026-10-19 schema. Any added table stops the reset for manual review.
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'cafe360_legacy_20261019')
      and c.relkind in ('r', 'p')
      and c.relname <> 'cafes'
      and not (c.relname = any(user_data_tables))
  ) then
    raise exception
      'STOP: unexpected application table found in public or cafe360_legacy_20261019. Review the schema and update this reviewed allowlist.';
  end if;

  -- Snapshot every café catalog table in these schemas, including the archived
  -- catalog, so a successful reset proves both active and archived rows remain.
  for t in
    select n.nspname, c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'cafe360_legacy_20261019')
      and c.relkind in ('r', 'p')
      and c.relname = 'cafes'
  loop
    execute format('select count(*) from %I.%I', t.nspname, t.relname)
      into remaining;
    catalog_before := catalog_before + remaining;
    catalog_table_count := catalog_table_count + 1;
  end loop;

  select string_agg(format('%I.%I', n.nspname, c.relname), ', '
                    order by n.nspname, c.relname)
    into target_list
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'cafe360_legacy_20261019')
    and c.relkind in ('r', 'p')
    and c.relname = any(user_data_tables);

  if target_list is null then
    raise exception 'STOP: no expected user-data tables found.';
  end if;

  execute 'truncate table ' || target_list || ' restart identity';
  delete from auth.users;

  if exists (select 1 from auth.users)
     or exists (select 1 from auth.identities)
     or exists (select 1 from auth.sessions) then
    raise exception 'Auth reset verification failed; transaction rolled back.';
  end if;

  for t in
    select n.nspname, c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'cafe360_legacy_20261019')
      and c.relkind in ('r', 'p')
      and c.relname = any(user_data_tables)
  loop
    execute format('select count(*) from %I.%I', t.nspname, t.relname)
      into remaining;
    if remaining <> 0 then
      raise exception 'User-data reset verification failed: %.%',
        t.nspname, t.relname;
    end if;
  end loop;

  for t in
    select n.nspname, c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'cafe360_legacy_20261019')
      and c.relkind in ('r', 'p')
      and c.relname = 'cafes'
  loop
    execute format('select count(*) from %I.%I', t.nspname, t.relname)
      into remaining;
    catalog_after := catalog_after + remaining;
  end loop;

  if catalog_table_count = 0 or catalog_after <> catalog_before then
    raise exception 'Café catalog preservation verification failed; transaction rolled back.';
  end if;

  if exists (select 1 from storage.objects) then
    raise exception 'Storage object verification failed; transaction rolled back.';
  end if;
end
$reset$;

commit;

-- Final read-only counts. Successful execution should report zero in the first
-- six columns while preserving the active café catalog count.
select
  (select count(*) from auth.users) as accounts_remaining,
  (select count(*) from auth.identities) as identities_remaining,
  (select count(*) from auth.sessions) as sessions_remaining,
  (select count(*) from public.profiles) as active_profiles_remaining,
  (select count(*) from public.groups) as active_circles_remaining,
  (select count(*) from storage.objects) as uploaded_files_remaining,
  (select count(*) from public.cafes) as active_cafes_preserved;
