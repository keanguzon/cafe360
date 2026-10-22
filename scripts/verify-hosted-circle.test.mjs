import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { it as test } from "vitest";
import { getConfig, isMissingStorageObject } from "./verify-hosted-circle.mjs";

const env = {
  NEXT_PUBLIC_SUPABASE_URL: "https://vhkxhfwkrhwqxbndtays.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-test-key",
  SUPABASE_SECRET_KEY: "secret-test-key",
};

test("dry run validates configuration without enabling hosted calls", () => {
  const config = getConfig([], env);
  assert.equal(config.apply, false);
  assert.equal(config.url, env.NEXT_PUBLIC_SUPABASE_URL);
});

test("CLI dry run exits before any hosted operation", () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("./verify-hosted-circle.mjs", import.meta.url))], {
    env: { ...process.env, ...env }, encoding: "utf8", timeout: 5_000,
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /No HTTP request or mutation made/);
});

test("apply requires the exact intended project reference", () => {
  assert.throws(() => getConfig(["--apply"], env), /project reference/i);
  assert.throws(() => getConfig(["--apply", "--project-ref", "anotherprojectref"], env), /project reference/i);
  assert.equal(getConfig(["--apply", "--project-ref", "vhkxhfwkrhwqxbndtays"], env).apply, true);
});

test("rejects a mismatched URL or missing required key", () => {
  assert.throws(() => getConfig(["--apply", "--project-ref", "vhkxhfwkrhwqxbndtays"], {
    ...env, NEXT_PUBLIC_SUPABASE_URL: "https://anotherprojectref.supabase.co",
  }), /URL/i);
  assert.throws(() => getConfig([], { ...env, SUPABASE_SECRET_KEY: "" }), /configuration/i);
});

test("rejects unsupported flags and duplicate arguments", () => {
  assert.throws(() => getConfig(["--wait-expiry"], env), /option/i);
  assert.throws(() => getConfig(["--project-ref", "vhkxhfwkrhwqxbndtays", "--project-ref", "vhkxhfwkrhwqxbndtays"], env), /option/i);
});

test("storage absence accepts explicit 404 only, including legacy statusCode", () => {
  assert.equal(isMissingStorageObject({ data: null, error: { status: 404 } }), true);
  assert.equal(isMissingStorageObject({ data: null, error: { status: 400, statusCode: "404" } }), true);
  assert.equal(isMissingStorageObject({ data: null, error: { status: 403 } }), false);
  assert.equal(isMissingStorageObject({ data: null, error: { status: 500, statusCode: "InternalError" } }), false);
  assert.equal(isMissingStorageObject({ data: { name: "present" }, error: null }), false);
});
