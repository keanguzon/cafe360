import { pathToFileURL } from "node:url";

const BUCKET = "visit-photos";
const PAGE_SIZE = 100;
const OWNER_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHOTO_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpe?g|png|webp)$/i;

async function* listPages(storage, prefix) {
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await storage.list(prefix, { limit: PAGE_SIZE, offset, sortBy: { column: "name", order: "asc" } });
    if (error || !Array.isArray(data)) throw new Error("Storage listing failed");
    yield data;
    if (data.length < PAGE_SIZE) return;
  }
}

export async function runCleanup({ storage, isAttached, now = new Date(), apply = false, writesPaused = false }) {
  if (apply && !writesPaused) throw new Error("--apply requires --writes-paused");
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error("Invalid clock");
  const cutoff = now.getTime() - 24 * 60 * 60 * 1000;
  const candidates = [];

  for await (const owners of listPages(storage, "")) {
    for (const owner of owners) {
      if (!OWNER_NAME.test(owner.name) || owner.id != null) continue;
      for await (const objects of listPages(storage, owner.name)) {
        for (const object of objects) {
          if (!PHOTO_NAME.test(object.name) || object.id == null) continue;
          const createdAt = Date.parse(object.created_at);
          if (!Number.isFinite(createdAt) || createdAt >= cutoff) continue;
          const path = `${owner.name}/${object.name}`;
          if (!(await isAttached(path))) candidates.push(path);
        }
      }
    }
  }

  let removed = 0;
  let skippedAfterRecheck = 0;
  if (apply) {
    for (const path of candidates) {
      if (await isAttached(path)) {
        skippedAfterRecheck++;
        continue;
      }
      const { error } = await storage.remove([path]);
      if (error) throw new Error("Storage object removal failed");
      removed++;
    }
  }
  return { candidates: candidates.length, removed, skippedAfterRecheck };
}

export function getCleanupConfig(env = process.env) {
  const url = env.SUPABASE_URL?.trim() || env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = env.SUPABASE_SECRET_KEY?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Server-only Supabase configuration is required");
  return { url, key };
}

async function main() {
  const flags = process.argv.slice(2);
  if (flags.some((flag) => flag !== "--apply" && flag !== "--writes-paused")) throw new Error("Unknown option");
  const apply = flags.includes("--apply");
  const writesPaused = flags.includes("--writes-paused");
  if (apply && !writesPaused) throw new Error("--apply requires --writes-paused");
  const { url, key } = getCleanupConfig();
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const storage = client.storage.from(BUCKET);
  const isAttached = async (path) => {
    for (const table of ["photo_attachment_locks", "visit_photos"]) {
      const { data, error } = await client.from(table).select("storage_path").eq("storage_path", path).limit(1);
      if (error || !Array.isArray(data)) throw new Error("Attachment check failed");
      if (data.length) return true;
    }
    return false;
  };
  const result = await runCleanup({ storage, isAttached, apply, writesPaused });
  console.log(`Visit photo cleanup: ${result.candidates} candidates, ${result.removed} removed, ${result.skippedAfterRecheck} attached during recheck.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error("Visit photo cleanup failed. Check configuration, permissions, and maintenance conditions.");
    process.exitCode = 1;
  });
}
