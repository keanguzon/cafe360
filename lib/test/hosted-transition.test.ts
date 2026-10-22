import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { buildHostedTransition } from "../../scripts/prepare-hosted-transition.mjs";
import { asUser } from "./database-harness";

const baseline = fileURLToPath(new URL("../../supabase/migrations/20261016000000_circle_baseline.sql", import.meta.url));
const quota = fileURLToPath(new URL("../../supabase/migrations/20261016000001_places_quota.sql", import.meta.url));

async function legacyFixture(db: PGlite) {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth; create schema storage; create schema extensions;
    grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb not null default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    create table storage.buckets(id text primary key, name text not null, public boolean not null,
      file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key, bucket_id text references storage.buckets(id),
      name text not null, owner_id text);
    create function storage.foldername(p_name text) returns text[] language sql immutable as $$
      select string_to_array(regexp_replace(p_name, '/[^/]*$', ''), '/') $$;
    grant execute on function storage.foldername(text) to anon, authenticated, service_role;
    grant select,insert,update,delete on storage.objects to authenticated,service_role;
    grant select on storage.objects to anon;
    alter table storage.objects enable row level security;
    create table public.profiles(id uuid primary key references auth.users(id) on delete cascade, username text not null unique,
      display_name text not null, avatar_url text, bio text, created_at timestamptz not null default now(),
      updated_at timestamptz not null default now());
    create table public.activities(id uuid primary key);
    create table public.cafe_interests(id uuid primary key);
    create table public.cafes(id uuid primary key);
    create table public.circle_cafe_hours(id uuid primary key);
    create table public.group_members(id uuid primary key);
    create table public.group_saved_cafes(id uuid primary key);
    create table public.groups(id uuid primary key);
    create table public.hangout_options(id uuid primary key);
    create table public.hangout_plans(id uuid primary key);
    create table public.hangout_votes(id uuid primary key);
    create table public.saved_cafes(id uuid primary key);
    create table public.visit_participants(id uuid primary key);
    create table public.visit_photos(id uuid primary key);
    create table public.visits(id uuid primary key);
    alter table public.groups add column created_by uuid references public.profiles(id);
    alter table public.group_members add column group_id uuid references public.groups(id);
    alter table public.group_members add column user_id uuid references public.profiles(id);
    alter table public.visits add column group_id uuid references public.groups(id);
    alter table public.visits add column cafe_id uuid references public.cafes(id);
    alter table public.visits add column created_by uuid references public.profiles(id);
    alter table public.activities add column group_id uuid references public.groups(id);
    alter table public.visit_photos add column visit_id uuid references public.visits(id);
    alter table public.visit_photos add column uploaded_by uuid references public.profiles(id);
    grant select on public.profiles to authenticated;
    grant insert,update on public.cafes to authenticated;
    create function public.create_join_group_activity() returns trigger language plpgsql as $$begin return new; end$$;
    create function public.create_photo_activity() returns trigger language plpgsql as $$begin return new; end$$;
    create function public.create_profile_for_new_user() returns trigger language plpgsql as $$begin return new; end$$;
    create function public.create_save_activity() returns trigger language plpgsql as $$begin return new; end$$;
    create function public.create_visit_activity() returns trigger language plpgsql as $$begin return new; end$$;
    create function public.is_group_admin(uuid) returns boolean language sql as $$select false$$;
    create function public.is_group_member(uuid) returns boolean language sql as $$select false$$;
    create function public.is_visit_participant(uuid) returns boolean language sql as $$select false$$;
    create function public.join_group_via_invite_code(text) returns void language sql as $$select$$;
    create function public.set_profile_updated_at() returns trigger language plpgsql as $$begin return new; end$$;
    create trigger create_profile_after_auth_signup after insert on auth.users
      for each row execute function public.create_profile_for_new_user();
    create trigger profiles_updated_at before update on public.profiles
      for each row execute function public.set_profile_updated_at();
    create trigger on_group_joined after insert on public.group_members
      for each row execute function public.create_join_group_activity();
    create policy "Public avatar reads" on storage.objects for select using(true);
    create policy "Users can delete their own avatar" on storage.objects for delete using(true);
    create policy "Users can update their own avatar" on storage.objects for update using(true);
    create policy "Users can upload their own avatar" on storage.objects for insert with check(true);
    create policy "Users can upload visit photos" on storage.objects for insert with check(true);
    create policy "Visit photos are publicly readable" on storage.objects for select using(true);
    insert into storage.buckets values
      ('avatars','avatars',true,5242880,array['image/jpeg','image/png','image/webp']),
      ('visit-photos','visit-photos',true,10485760,null);
    insert into storage.objects values
      ('50000000-0000-4000-8000-000000000001','avatars','a/a.png','10000000-0000-4000-8000-000000000001'),
      ('50000000-0000-4000-8000-000000000002','avatars','b/b.png','10000000-0000-4000-8000-000000000002');
  `);
  for (let i = 1; i <= 6; i++) {
    const id = `10000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
    await db.query("insert into auth.users(id,raw_user_meta_data) values($1,$2::jsonb)", [id, JSON.stringify({ username: `user_${i}` })]);
    await db.query("insert into public.profiles(id,username,display_name,bio) values($1,$2,$3,$4)", [id, `user_${i}`, `User ${i}`, `Bio ${i}`]);
  }
  for (let i = 1; i <= 5; i++) {
    await db.query("insert into public.groups(id) values($1)", [`20000000-0000-4000-8000-${String(i).padStart(12, "0")}`]);
  }
  for (const [table, count] of [["activities", 14], ["cafe_interests", 3], ["cafes", 10],
    ["group_members", 6], ["saved_cafes", 4]] as const) {
    for (let i = 1; i <= count; i++) {
      await db.query(`insert into public.${table}(id) values($1)`, [
        `40000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      ]);
    }
  }
  await db.exec("insert into public.visits(id) values('30000000-0000-4000-8000-000000000001')");
}

describe("offline hosted transition", () => {
  it("composes one transaction from the checked-in migrations and rejects source drift", async () => {
    const sql = await buildHostedTransition();
    expect(sql).toMatch(/^begin;\n/);
    expect(sql).toMatch(/commit;\s*$/);
    expect(sql).toContain("alter table public.profiles set schema cafe360_legacy_20261019");
    expect(sql).toContain("insert into public.profiles(id,username,display_name,avatar_url,bio,created_at,updated_at)");
    expect(sql).toContain("create function public.consume_places_quota");
    expect(sql).not.toContain("insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)");
    expect(await readFile(baseline, "utf8")).toContain("insert into storage.buckets");
    expect(await readFile(quota, "utf8")).toContain("consume_places_quota");
    await expect(buildHostedTransition({ baselineSql: "select 1;" })).rejects.toThrow(/bucket block/);
  });

  it("aborts and rolls back before archiving when an unexpected public table is present", async () => {
    const db = new PGlite({ extensions: { pgcrypto } });
    try {
      await legacyFixture(db);
      await db.exec("create table public.unexpected(id int)");
      await expect(db.exec(await buildHostedTransition())).rejects.toThrow(/unexpected public table/i);
      await db.exec("rollback");
      expect((await db.query("select to_regclass('public.profiles') as profile, to_regnamespace('cafe360_legacy_20261019') as archived")).rows[0])
        .toMatchObject({ profile: "profiles", archived: null });
    } finally {
      await db.close();
    }
  }, 30_000);

  it("preserves accounts, profiles and object metadata while replacing the public schema", async () => {
    const db = new PGlite({ extensions: { pgcrypto } });
    try {
      await legacyFixture(db);
      const sql = await buildHostedTransition();
      await db.exec(sql);
      const counts = await db.query<{ users: number; profiles: number; archived: number; objects: number }>(`
        select (select count(*)::int from auth.users) users,
          (select count(*)::int from public.profiles) profiles,
          (select count(*)::int from cafe360_legacy_20261019.profiles) archived,
          (select count(*)::int from storage.objects) objects`);
      expect(counts.rows[0]).toEqual({ users: 6, profiles: 6, archived: 6, objects: 2 });
      const oldRows = await db.query<{ groups: number; visits: number }>(`
        select (select count(*)::int from cafe360_legacy_20261019.groups) groups,
          (select count(*)::int from cafe360_legacy_20261019.visits) visits`);
      expect(oldRows.rows[0]).toEqual({ groups: 5, visits: 1 });
      const archivedDependencies = await db.query<{ fk_count: number; disabled_triggers: number }>(`
        select (select count(*)::int from pg_constraint
          where conrelid='cafe360_legacy_20261019.groups'::regclass
            and confrelid='cafe360_legacy_20261019.profiles'::regclass) fk_count,
          (select count(*)::int from pg_trigger
            where tgrelid='cafe360_legacy_20261019.profiles'::regclass
              and tgname='profiles_updated_at' and tgenabled='D') disabled_triggers`);
      expect(archivedDependencies.rows[0]).toEqual({ fk_count: 1, disabled_triggers: 1 });
      const bucket = await db.query<{ public: boolean; file_size_limit: string }>(
        "select public,file_size_limit from storage.buckets where id='visit-photos'");
      expect(bucket.rows[0].public).toBe(false);
      expect(Number(bucket.rows[0].file_size_limit)).toBe(5242880);
      expect((await db.query("select username,bio from public.profiles where username='user_1'")).rows[0])
        .toEqual({ username: "user_1", bio: "Bio 1" });
      expect((await db.query<{ old_table: string | null }>("select to_regclass('public.hangout_plans') as old_table")).rows[0].old_table).toBeNull();
      expect((await db.query<{ new_table: string | null }>("select to_regclass('public.photo_attachment_locks') as new_table")).rows[0].new_table)
        .toBe("photo_attachment_locks");
      await asUser(db, "10000000-0000-4000-8000-000000000001", async () => {
        await expect(db.query("select id from cafe360_legacy_20261019.profiles"))
          .rejects.toMatchObject({ code: "42501" });
        await expect(db.query("insert into public.cafes(provider_place_id,name,lat,lng) values('bad','Bad',0,0)"))
          .rejects.toMatchObject({ code: "42501" });
        const circle = await db.query<{ result: { groupId: string } }>(
          "select public.create_circle('Fresh circle',null) as result");
        expect(circle.rows[0].result.groupId).toBeTruthy();
        await expect(db.query("insert into public.group_members(group_id,user_id,role) values($1,$2,'member')",
          [circle.rows[0].result.groupId, "10000000-0000-4000-8000-000000000002"]))
          .rejects.toMatchObject({ code: "42501" });
      });
      await expect(db.exec(sql)).rejects.toThrow(/archive schema already exists|unexpected public table/i);
      await db.exec("rollback");
    } finally {
      await db.close();
    }
  }, 30_000);

  it("rolls back the archive if a later baseline statement fails", async () => {
    const db = new PGlite({ extensions: { pgcrypto } });
    try {
      await legacyFixture(db);
      const changed = `${await readFile(baseline, "utf8")}\nselect 1/0;\n`;
      await expect(db.exec(await buildHostedTransition({ baselineSql: changed }))).rejects.toThrow();
      await db.exec("rollback");
      const state = await db.query<{ original: string | null; archived: string | null; objects: number; profiles: number }>(`
        select to_regclass('public.profiles') original,
          to_regclass('cafe360_legacy_20261019.profiles') archived,
          (select count(*)::int from storage.objects) objects,
          (select count(*)::int from public.profiles) profiles`);
      expect(state.rows[0]).toEqual({ original: "profiles", archived: null, objects: 2, profiles: 6 });
      expect((await db.query<{ public: boolean }>(
        "select public from storage.buckets where id='visit-photos'")) .rows[0].public).toBe(true);
    } finally {
      await db.close();
    }
  }, 30_000);
});
