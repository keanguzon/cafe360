import assert from "node:assert/strict";
import { it as test } from "vitest";
import { getCleanupConfig, runCleanup } from "./cleanup-visit-photos.mjs";

test("cleanup prefers the new server secret and supports legacy fallback without a public-key fallback", () => {
  const base = { NEXT_PUBLIC_SUPABASE_URL: " https://project.supabase.co ", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-test" };
  assert.deepEqual(getCleanupConfig({ ...base, SUPABASE_SECRET_KEY: " sb_secret_test ", SUPABASE_SERVICE_ROLE_KEY: "legacy" }),
    { url: "https://project.supabase.co", key: "sb_secret_test" });
  assert.equal(getCleanupConfig({ ...base, SUPABASE_SECRET_KEY: " ", SUPABASE_SERVICE_ROLE_KEY: " legacy " }).key, "legacy");
  assert.throws(() => getCleanupConfig(base), /Server-only Supabase configuration/);
});

const old = "2026-10-14T00:00:00.000Z";
const recent = "2026-10-16T00:00:00.000Z";
const owner = "11111111-1111-4111-8111-111111111111";
const file = "22222222-2222-4222-8222-222222222222.jpg";
const path = `${owner}/${file}`;

function harness({ attachedAfterFirstCheck = false } = {}) {
  let checks = 0;
  const removed = [];
  const storage = {
    list: async (prefix) => ({ data: prefix ? [
      { name: file, id: "object-1", created_at: old },
      { name: "33333333-3333-4333-8333-333333333333.jpg", id: "object-2", created_at: recent },
    ] : [{ name: owner, id: null }], error: null }),
    remove: async (paths) => { removed.push(paths); return { data: [], error: null }; },
  };
  const isAttached = async () => { checks++; return attachedAfterFirstCheck && checks > 1; };
  return { storage, isAttached, removed, get checks() { return checks; } };
}

test("dry run finds old unattached objects without deleting bytes", async () => {
  const h = harness();
  const result = await runCleanup({ ...h, now: new Date("2026-10-16T12:00:00.000Z") });
  assert.deepEqual(result, { candidates: 1, removed: 0, skippedAfterRecheck: 0 });
  assert.deepEqual(h.removed, []);
});

test("apply requires an explicit write pause", async () => {
  const h = harness();
  await assert.rejects(runCleanup({ ...h, apply: true, now: new Date("2026-10-16T12:00:00.000Z") }), /writes-paused/);
  assert.deepEqual(h.removed, []);
});

test("an attachment created after listing prevents Storage API removal", async () => {
  const h = harness({ attachedAfterFirstCheck: true });
  const result = await runCleanup({ ...h, apply: true, writesPaused: true, now: new Date("2026-10-16T12:00:00.000Z") });
  assert.deepEqual(result, { candidates: 1, removed: 0, skippedAfterRecheck: 1 });
  assert.deepEqual(h.removed, []);
  assert.equal(h.checks, 2);
});

test("a confirmed orphan is removed through Storage API", async () => {
  const h = harness();
  const result = await runCleanup({ ...h, apply: true, writesPaused: true, now: new Date("2026-10-16T12:00:00.000Z") });
  assert.equal(result.removed, 1);
  assert.deepEqual(h.removed, [[path]]);
});

test("an attachment-check failure stops cleanup before any deletion", async () => {
  const h = harness();
  await assert.rejects(runCleanup({ storage: h.storage, isAttached: async () => { throw new Error("database unavailable"); }, apply: true, writesPaused: true, now: new Date("2026-10-16T12:00:00.000Z") }), /database unavailable/);
  assert.deepEqual(h.removed, []);
});
