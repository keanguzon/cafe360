import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

// Use a disposable localhost cluster; only newly created roles are cleaned up.
const connection = new URL(process.env.PHOTO_RACE_DATABASE_URL ?? "postgres://postgres@127.0.0.1:55439/postgres");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(connection.hostname), "Only localhost test servers are supported");
const require = createRequire(resolve(process.env.PHOTO_RACE_DRIVER_ROOT ?? ".tmp/pg-race", "package.json"));
const { Client } = require("pg");
const legacy = process.argv.includes("--legacy-delete");
const baselineFlag = process.argv.indexOf("--baseline");
const baselinePath = baselineFlag >= 0 ? process.argv[baselineFlag + 1] : "supabase/migrations/20261016000000_circle_baseline.sql";
const database = `cafe360_photo_race_${randomUUID().replaceAll("-", "")}`;
const owner = "10000000-0000-4000-8000-000000000001";
const gateKey = 2718281828;
const sessions = [];
const createdRoles = [];
const control = new Client({ connectionString: connection.href });
await control.connect();

async function session(asOwner = false) {
  const url = new URL(connection);
  url.pathname = `/${database}`;
  const client = new Client({ connectionString: url.href });
  await client.connect();
  sessions.push(client);
  await client.query("set statement_timeout='8s'");
  if (asOwner) {
    await client.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
    await client.query("set role authenticated");
  }
  return client;
}

function observe(work) {
  return work.then((value) => ({ value }), (error) => ({ error }));
}

async function waitForBlock(observer, blocked, blocker) {
  const until = Date.now() + 4000;
  while (Date.now() < until) {
    const result = await observer.query("select $1::integer=any(pg_blocking_pids($2::integer)) as blocked", [blocker.processID, blocked.processID]);
    if (result.rows[0].blocked) return;
    await delay(10);
  }
  assert.fail("Expected database sessions to block on the conflicting operation");
}

try {
  for (const role of ["anon", "authenticated", "service_role"]) {
    const exists = await control.query("select 1 from pg_roles where rolname=$1", [role]);
    if (!exists.rowCount) {
      await control.query(`create role ${role} nologin ${role === "service_role" ? "bypassrls" : ""}`);
      createdRoles.push(role);
    }
  }
  await control.query(`create database ${database}`);
  const db = await session();
  const harness = await readFile("lib/test/database-harness.ts", "utf8");
  const fixture = harness.match(/const platformFixture = `([\s\S]*?)`;/)?.[1];
  assert.ok(fixture, "Database platform fixture not found");
  await db.query(fixture.replace(/^create role .*;\r?$/gm, ""));
  await db.query(await readFile(baselinePath, "utf8"));
  await db.query("insert into auth.users(id,raw_user_meta_data) values($1,'{\"username\":\"race_owner\"}')", [owner]);
  const actor = await session(true);
  const second = await session(true);
  const gate = await session();
  const circle = (await actor.query("select public.create_circle('Race',null) as value")).rows[0].value.groupId;
  const cafe = (await db.query("insert into public.cafes(provider_place_id,name,lat,lng) values('race-cafe','Cafe',14.6,121) returning id")).rows[0].id;
  const visit = (path) => ({ groupId: circle, cafeId: cafe, visitedAt: "2026-10-16", photos: [{ storagePath: path }] });
  const addObject = async () => {
    const path = `${owner}/${randomUUID()}.jpg`;
    await db.query("insert into storage.objects(bucket_id,name,owner_id) values('visit-photos',$1,$2)", [path, owner]);
    return path;
  };
  await db.query(`create function public.pause_race_visit() returns trigger language plpgsql as $$
    begin perform pg_advisory_xact_lock(${gateKey}::bigint); return new; end $$;
    create trigger pause_race_visit before insert on public.visits for each row execute function public.pause_race_visit();`);

  // Hold the visit after its object validation/claim, before photo metadata insertion.
  const firstPath = await addObject();
  await gate.query("begin");
  await gate.query("select pg_advisory_xact_lock($1::bigint)", [gateKey]);
  const attaching = observe(actor.query("select public.create_circle_visit($1::jsonb)", [visit(firstPath)]));
  await waitForBlock(db, actor, gate);
  if (legacy) {
    const deleted = await second.query("delete from storage.objects where bucket_id='visit-photos' and name=$1 returning id", [firstPath]);
    assert.equal(deleted.rowCount, 1);
    await gate.query("commit");
    assert.equal((await attaching).error, undefined);
  } else {
    const deleting = observe(second.query("select public.claim_temporary_photo_delete($1) as allowed", [firstPath]));
    await waitForBlock(db, second, actor);
    await gate.query("commit");
    assert.equal((await attaching).error, undefined);
    const denied = await deleting;
    assert.equal(denied.error, undefined);
    assert.equal(denied.value.rows[0].allowed, false);
  }
  const orphaned = await db.query("select p.storage_path from public.visit_photos p left join storage.objects o on o.bucket_id='visit-photos' and o.name=p.storage_path where o.id is null");
  assert.equal(orphaned.rowCount, 0, "Visit committed a photo whose object was concurrently deleted");
  console.log("PASS attachment wins: competing deletion cannot claim the photo");

  const secondPath = await addObject();
  await second.query("begin");
  assert.equal((await second.query("select public.claim_temporary_photo_delete($1) as allowed", [secondPath])).rows[0].allowed, true);
  const losingVisit = observe(actor.query("select public.create_circle_visit($1::jsonb)", [visit(secondPath)]));
  await waitForBlock(db, actor, second);
  await second.query("commit");
  assert.equal((await losingVisit).error?.code, "22023");
  assert.equal((await db.query("select 1 from public.visit_photos where storage_path=$1", [secondPath])).rowCount, 0);
  assert.equal((await second.query("select public.claim_temporary_photo_delete($1) as allowed", [secondPath])).rows[0].allowed, true);
  assert.equal((await second.query("delete from storage.objects where name=$1 returning id", [secondPath])).rowCount, 0);
  console.log("PASS deletion wins: attachment rolls back; retry remains safe; direct client deletion denied");
} finally {
  for (const client of sessions) await client.end().catch(() => {});
  await control.query(`drop database if exists ${database} with (force)`);
  for (const role of createdRoles.reverse()) await control.query(`drop role ${role}`);
  await control.end();
}
