import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

export type Database = PGlite;

const baselinePath = fileURLToPath(
  new URL("../../supabase/migrations/20261016000000_circle_baseline.sql", import.meta.url),
);

const platformFixture = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema storage;
create schema extensions;
grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
create table auth.users (
  id uuid primary key,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name text not null,
  owner_id text,
  unique(bucket_id, name)
);
create function storage.foldername(p_name text) returns text[]
language sql immutable as $$
  select string_to_array(regexp_replace(p_name, '/[^/]*$', ''), '/')
$$;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to authenticated, service_role;
grant select on storage.objects to anon;
alter table storage.objects enable row level security;
`;

export async function createDatabase(): Promise<Database> {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(platformFixture);
    // Run the checked-in migration unchanged, including its extension statement.
    await db.exec(await readFile(baselinePath, "utf8"));
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}

export async function asUser<T>(db: Database, userId: string | null, work: () => Promise<T>): Promise<T> {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
  await db.exec(`set role ${userId === null ? "anon" : "authenticated"}`);
  try {
    return await work();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

export async function addUser(db: Database, id: string, username: string): Promise<void> {
  await db.query(
    "insert into auth.users(id, raw_user_meta_data) values ($1, $2::jsonb)",
    [id, JSON.stringify({ username, display_name: username })],
  );
}

export async function addCafe(db: Database, providerId: string): Promise<string> {
  const result = await db.query<{ id: string }>(
    "insert into public.cafes(provider_place_id,name,lat,lng) values ($1,'Cafe',14.6,121.0) returning id",
    [providerId],
  );
  return result.rows[0].id;
}
