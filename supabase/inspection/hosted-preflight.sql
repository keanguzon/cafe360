-- Run in the Supabase SQL editor as an administrator. Exports metadata only.
-- No application rows. Schema expressions/settings can contain literals;
-- review the export privately before sharing or committing it.
begin read only;
set local statement_timeout = '15s';

select 'tables' as section, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as metadata
from (
  select n.nspname as schema, c.relname as name, c.relrowsecurity as rls,
         c.relforcerowsecurity as force_rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
  order by c.relname
) t
union all
select 'columns', coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
from (
  select table_name, column_name, data_type, is_nullable
  from information_schema.columns where table_schema = 'public'
  order by table_name, ordinal_position
) t
union all
select 'policies', coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
from (
  select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
  from pg_policies where schemaname in ('public', 'storage')
  order by schemaname, tablename, policyname
) t
union all
select 'table_grants', coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
from (
  select table_schema, table_name, grantee, privilege_type
  from information_schema.table_privileges
  where table_schema in ('public', 'storage')
  order by table_schema, table_name, grantee, privilege_type
) t
union all
select 'functions', coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
from (
  select p.proname as name, p.prokind as kind,
         pg_get_function_identity_arguments(p.oid) as arguments,
         p.prosecdef as security_definer, p.proconfig as settings,
         p.proacl::text as acl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind in ('f', 'p')
  order by p.proname, arguments
) t
union all
select 'triggers', coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
from (
  select n.nspname as schema, c.relname as table_name, t.tgname as name,
         pg_get_triggerdef(t.oid) as definition
  from pg_trigger t join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal and n.nspname in ('auth', 'public', 'storage')
  order by n.nspname, c.relname, t.tgname
) t
union all
select 'publications', coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
from (
  select pubname, schemaname, tablename from pg_publication_tables
  where schemaname = 'public' order by pubname, tablename
) t;

select id, public, file_size_limit, allowed_mime_types
from storage.buckets order by id;

-- Some dashboard-built projects have no CLI migration history table.
select to_regclass('supabase_migrations.schema_migrations') as migration_history_table;
-- If present, run separately: select version from supabase_migrations.schema_migrations order by version;
-- Do not export its statements column: it may contain sensitive literals.

rollback;
