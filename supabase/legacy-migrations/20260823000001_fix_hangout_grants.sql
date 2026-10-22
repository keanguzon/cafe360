-- Fix: Hangout tables were missing GRANT statements.
-- RLS policies existed but the authenticated role had no table-level permission.
-- Without these GRANTs, all PostgREST queries from the Supabase client fail
-- with "permission denied for table hangout_plans/options/votes".

-- hangout_plans: members can SELECT and INSERT, creators can UPDATE
grant select, insert, update on table public.hangout_plans to authenticated;

-- hangout_options: members can SELECT and INSERT
grant select, insert on table public.hangout_options to authenticated;

-- hangout_votes: members can SELECT and INSERT (upsert requires INSERT + UPDATE on PK conflict)
grant select, insert, update on table public.hangout_votes to authenticated;
