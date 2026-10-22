import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { addUser, asUser, createDatabase, type Database } from "./database-harness";

const migrationPath = fileURLToPath(new URL("../../supabase/migrations/20261016000001_places_quota.sql", import.meta.url));
const userA = "11111111-1111-4111-8111-111111111111";
const userB = "22222222-2222-4222-8222-222222222222";
let db: Database;

beforeEach(async () => {
  db = await createDatabase();
  await db.exec(await readFile(migrationPath, "utf8"));
  await addUser(db, userA, "quota_a");
  await addUser(db, userB, "quota_b");
}, 30_000);
afterEach(async () => { await db.close(); });

async function consume(user: string, route: string) {
  return asUser(db, user, async () => {
    const result = await db.query<{ value: { allowed: boolean; retryAfterSeconds: number } }>(
      "select public.consume_places_quota($1) as value", [route],
    );
    return result.rows[0].value;
  });
}

describe("Places quota migration", () => {
  it("allows 30 searches per minute then denies with a retry delay", async () => {
    for (let i = 0; i < 30; i++) expect((await consume(userA, "search")).allowed).toBe(true);
    const denied = await consume(userA, "search");
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
    expect(denied.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("keeps details and other actors in independent windows", async () => {
    for (let i = 0; i < 30; i++) await consume(userA, "search");
    expect((await consume(userA, "details")).allowed).toBe(true);
    expect((await consume(userB, "search")).allowed).toBe(true);
    for (let i = 1; i < 60; i++) expect((await consume(userA, "details")).allowed).toBe(true);
    expect((await consume(userA, "details")).allowed).toBe(false);
  });

  it("rejects anonymous and unknown routes", async () => {
    await expect(asUser(db, null, () => db.query("select public.consume_places_quota('search')"))).rejects.toThrow();
    await expect(consume(userA, "other")).rejects.toThrow();
  });

  it("prevents direct quota table access", async () => {
    await expect(asUser(db, userA, () => db.query("select * from public.places_quota_window"))).rejects.toThrow();
  });
});
