import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PROJECT_REF = "vhkxhfwkrhwqxbndtays";
const BUCKET = "visit-photos";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9D8xkAAAAASUVORK5CYII=", "base64");

export function getConfig(args, env = process.env) {
  const flags = [...args];
  const apply = flags.filter((x) => x === "--apply").length === 1;
  const refIndex = flags.indexOf("--project-ref");
  const ref = refIndex < 0 ? null : flags[refIndex + 1];
  const allowed = refIndex < 0 ? ["--apply"] : ["--apply", "--project-ref", ref];
  if (flags.length !== new Set(flags).size || flags.some((x) => !allowed.includes(x)) ||
      (refIndex >= 0 && (!ref || ref.startsWith("--"))) || flags.filter((x) => x === "--project-ref").length > 1) {
    throw new Error("Invalid option");
  }
  if (apply && ref !== PROJECT_REF) throw new Error("Apply requires the exact project reference");
  if (ref && ref !== PROJECT_REF) throw new Error("Unexpected project reference");
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey = env.SUPABASE_SECRET_KEY?.trim();
  const publicKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !secretKey || !publicKey) throw new Error("Supabase configuration is incomplete");
  if (url !== `https://${PROJECT_REF}.supabase.co`) throw new Error("Supabase URL does not match project reference");
  return { apply, url, secretKey, publicKey };
}

export function isMissingStorageObject(info) {
  return info.data === null && info.error != null &&
    (Number(info.error.status) === 404 || String(info.error.statusCode) === "404");
}

function checked(result, label) {
  if (result.error) throw new Error(label);
  return result.data;
}

function requireValue(value, label) {
  if (!value) throw new Error(label);
  return value;
}

function expect(condition, label) {
  if (!condition) throw new Error(label);
}

async function check(name, fn, results) {
  await fn();
  results.push(name);
  console.log(`PASS ${name}`);
}

export async function runHosted(config, createClient) {
  if (!config.apply) throw new Error("Hosted run requires --apply");
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  const admin = createClient(config.url, config.secretKey, options);
  const owned = { users: [], circles: [], paths: [], cafeId: null };
  const results = [];
  const cleanupErrors = [];
  const journalDir = fileURLToPath(new URL("../.tmp/", import.meta.url));
  const journalPath = join(journalDir, `hosted-circle-${randomUUID()}.json`);
  let owner;
  let workError;

  async function saveJournal() {
    const temporary = `${journalPath}.tmp`;
    await writeFile(temporary, JSON.stringify({
      projectRef: PROJECT_REF,
      userIds: owned.users,
      circleIds: owned.circles,
      cafeId: owned.cafeId,
      photoPaths: owned.paths,
    }), { mode: 0o600 });
    await rename(temporary, journalPath);
  }

  async function assertObjectPresent(path, label) {
    const downloaded = checked(await admin.storage.from(BUCKET).download(path), label);
    expect(Buffer.compare(Buffer.from(await downloaded.arrayBuffer()), PNG) === 0, label);
  }

  async function assertObjectAbsent(path, label) {
    const info = await admin.storage.from(BUCKET).info(path);
    expect(isMissingStorageObject(info), label);
  }

  async function makeUser() {
    const email = `cafe360-check-${randomUUID()}@example.com`;
    const password = randomBytes(32).toString("base64url");
    const created = checked(await admin.auth.admin.createUser({ email, password, email_confirm: true }), "create test user");
    const id = requireValue(created?.user?.id, "create test user");
    owned.users.push(id);
    await saveJournal();
    const client = createClient(config.url, config.publicKey, options);
    const session = checked(await client.auth.signInWithPassword({ email, password }), "sign in test user");
    expect(session?.user?.id === id && !!session?.session?.access_token, "sign in test user");
    return { id, client };
  }

  try {
    await mkdir(journalDir, { recursive: true });
    await saveJournal();
    owner = await makeUser();
    const member = await makeUser();
    const outsider = await makeUser();
    await check("three isolated account sessions", async () => {
      expect(new Set([owner.id, member.id, outsider.id]).size === 3, "account isolation");
    }, results);

    const providerId = `cafe360-check-${randomUUID()}`;
    const cafe = checked(await admin.from("cafes").insert({ provider_place_id: providerId, name: "Acceptance fixture", lat: 25.033, lng: 121.5654 }).select("id").single(), "create fixture cafe");
    owned.cafeId = requireValue(cafe?.id, "create fixture cafe");
    await saveJournal();

    const a = checked(await owner.client.rpc("create_circle", { p_name: `Acceptance A ${randomUUID().slice(0, 8)}`, p_description: null }), "create Circle A");
    owned.circles.push(requireValue(a?.groupId, "create Circle A"));
    await saveJournal();
    const b = checked(await owner.client.rpc("create_circle", { p_name: `Acceptance B ${randomUUID().slice(0, 8)}`, p_description: null }), "create Circle B");
    owned.circles.push(requireValue(b?.groupId, "create Circle B"));
    await saveJournal();
    const groupA = a.groupId;
    const groupB = b.groupId;
    await check("Circle creation and invitation join", async () => {
      const preview = checked(await member.client.rpc("preview_circle_invite", { p_code: a.inviteCode }), "preview Circle A");
      expect(preview?.name && Number(preview.memberCount) === 1, "Circle invite preview");
      const joined = checked(await member.client.rpc("join_circle", { p_code: a.inviteCode }), "join Circle A");
      expect(joined?.groupId === groupA, "join Circle A");
      const again = checked(await member.client.rpc("join_circle", { p_code: a.inviteCode }), "join Circle A again");
      expect(again?.groupId === groupA, "idempotent Circle join");
      const memberships = checked(await member.client.from("group_members").select("user_id").eq("group_id", groupA), "read memberships");
      expect(memberships?.length === 2, "Circle A member count");
    }, results);

    await check("personal saves stay private", async () => {
      checked(await owner.client.from("saved_cafes").insert({ user_id: owner.id, cafe_id: owned.cafeId, collection: "Acceptance" }), "save personal cafe");
      const own = checked(await owner.client.from("saved_cafes").select("id").eq("user_id", owner.id).eq("cafe_id", owned.cafeId), "read own save");
      expect(own?.length === 1, "owner sees personal save");
      for (const actor of [member, outsider]) {
        const rows = checked(await actor.client.from("saved_cafes").select("id").eq("user_id", owner.id).eq("cafe_id", owned.cafeId), "read another personal save");
        expect(rows?.length === 0, "personal save isolated");
      }
    }, results);

    await check("Circle hours follow membership and submitter", async () => {
      checked(await owner.client.from("circle_cafe_hours").insert({ group_id: groupA, cafe_id: owned.cafeId, day_of_week: 1, open_time: "09:00", close_time: "17:00", submitted_by: owner.id }), "create Circle hours");
      const seen = checked(await member.client.from("circle_cafe_hours").select("id").eq("group_id", groupA), "read Circle hours");
      expect(seen?.length === 1, "member sees Circle hours");
      const revised = checked(await member.client.from("circle_cafe_hours").update({ open_time: "10:00", submitted_by: member.id }).eq("id", seen[0].id).select("submitted_by,open_time").single(), "revise Circle hours");
      expect(revised?.submitted_by === member.id && revised.open_time === "10:00:00", "member revises own submission");
      const hidden = checked(await outsider.client.from("circle_cafe_hours").select("id").eq("group_id", groupA), "outsider hours read");
      expect(hidden?.length === 0, "outsider hours hidden");
      const crossCircle = await member.client.from("circle_cafe_hours").insert({ group_id: groupB, cafe_id: owned.cafeId, day_of_week: 2, open_time: "09:00", close_time: "17:00", submitted_by: member.id });
      expect(!!crossCircle.error, "nonmember Circle hours write denied");
    }, results);

    // The normal quota RPC also expires old operational counters for all users.
    await check("Places quota accepts only its two routes", async () => {
      for (const route of ["search", "details"]) {
        const quota = checked(await owner.client.rpc("consume_places_quota", { p_route: route }), "consume Places quota");
        expect(quota?.allowed === true && quota.retryAfterSeconds === 0, "Places quota allowed");
      }
      const invalid = await owner.client.rpc("consume_places_quota", { p_route: "invalid" });
      expect(!!invalid.error, "invalid Places route denied");
    }, results);

    await check("outsider Circle and membership isolation", async () => {
      for (const table of ["groups", "group_members", "visits"]) {
        const column = table === "groups" ? "id" : "group_id";
        const rows = checked(await outsider.client.from(table).select("*").eq(column, groupA), `outsider ${table} read`);
        expect(rows?.length === 0, `outsider ${table} read`);
      }
      const injection = await outsider.client.from("group_members").insert({ group_id: groupA, user_id: outsider.id, role: "member" });
      expect(!!injection.error, "direct membership write denied");
      const cafeWrite = await outsider.client.from("cafes").insert({ provider_place_id: `cafe360-check-${randomUUID()}`, name: "Denied", lat: 0, lng: 0 });
      expect(!!cafeWrite.error, "direct cafe write denied");
      const summary = await outsider.client.rpc("circle_cafe_summaries", { p_group_id: groupA });
      expect(!!summary.error, "outsider summary denied");
    }, results);

    await check("invalid participant rolls back atomically", async () => {
      const bad = await owner.client.rpc("create_circle_visit", { p_input: {
        groupId: groupA, cafeId: owned.cafeId, visitedAt: "2026-10-19", rating: 0,
        participants: [outsider.id], photos: [],
      } });
      expect(!!bad.error, "outsider participant denied");
      const visits = checked(await owner.client.from("visits").select("id").eq("group_id", groupA), "visit rollback read");
      const activities = checked(await owner.client.from("activities").select("id").eq("group_id", groupA), "activity rollback read");
      expect(visits?.length === 0 && activities?.length === 0, "invalid visit rollback");
    }, results);

    const temporaryPath = `${owner.id}/${randomUUID()}.png`;
    owned.paths.push(temporaryPath);
    await saveJournal();
    checked(await owner.client.storage.from(BUCKET).upload(temporaryPath, PNG, { contentType: "image/png", upsert: false }), "upload temporary photo");
    await check("temporary photo claim and Storage removal", async () => {
      await owner.client.storage.from(BUCKET).remove([temporaryPath]);
      await assertObjectPresent(temporaryPath, "direct Storage deletion denied");
      const claim = checked(await owner.client.rpc("claim_temporary_photo_delete", { p_path: temporaryPath }), "claim temporary photo");
      expect(claim === true, "temporary photo claim");
      checked(await admin.storage.from(BUCKET).remove([temporaryPath]), "remove temporary photo");
      await assertObjectAbsent(temporaryPath, "remove temporary photo");
      const object = checked(await admin.from("photo_attachment_locks").select("state").eq("storage_path", temporaryPath), "read deletion claim");
      expect(object?.length === 1 && object[0].state === "deleting", "durable deletion claim");
    }, results);

    const attachedPath = `${owner.id}/${randomUUID()}.png`;
    owned.paths.push(attachedPath);
    await saveJournal();
    checked(await owner.client.storage.from(BUCKET).upload(attachedPath, PNG, { contentType: "image/png", upsert: false }), "upload attached photo");
    const visit = checked(await owner.client.rpc("create_circle_visit", { p_input: {
      groupId: groupA, cafeId: owned.cafeId, visitedAt: "2026-10-19", rating: 0,
      participants: [owner.id, member.id], photos: [{ storagePath: attachedPath, caption: "Acceptance" }],
    } }), "create visit with photo");
    await check("zero rating, participants, and private attachment", async () => {
      const visitId = requireValue(visit?.visitId, "created visit ID");
      const rows = checked(await member.client.from("visits").select("id,rating,visited_at").eq("id", visitId), "member visit read");
      const people = checked(await member.client.from("visit_participants").select("user_id").eq("visit_id", visitId), "member participant read");
      const photos = checked(await member.client.from("visit_photos").select("id").eq("visit_id", visitId), "member photo metadata read");
      expect(rows?.length === 1 && Number(rows[0].rating) === 0 && rows[0].visited_at === "2026-10-19", "zero rating visit");
      expect(people?.length === 2 && photos?.length === 1, "visit children");
      const claim = checked(await owner.client.rpc("claim_temporary_photo_delete", { p_path: attachedPath }), "claim attached photo");
      expect(claim === false, "attached photo claim denied");
      await owner.client.storage.from(BUCKET).remove([attachedPath]);
      await assertObjectPresent(attachedPath, "attached direct Storage deletion denied");
    }, results);

    await check("owner and member can read bytes; outsider cannot", async () => {
      for (const actor of [owner, member]) {
        const allowed = checked(await actor.client.rpc("can_read_visit_photo", { p_path: attachedPath }), "photo permission");
        expect(allowed === true, "photo permission");
        const signed = checked(await actor.client.storage.from(BUCKET).createSignedUrl(attachedPath, 60), "mint signed URL");
        expect(!!signed?.signedUrl, "signed URL minted");
        const response = await fetch(signed.signedUrl);
        expect(response.ok && Buffer.compare(Buffer.from(await response.arrayBuffer()), PNG) === 0, "signed byte read");
      }
      const allowed = checked(await outsider.client.rpc("can_read_visit_photo", { p_path: attachedPath }), "outsider photo permission");
      expect(allowed === false, "outsider photo permission");
      const signed = await outsider.client.storage.from(BUCKET).createSignedUrl(attachedPath, 60);
      expect(!!signed.error, "outsider signed URL denied");
      const direct = await outsider.client.storage.from(BUCKET).download(attachedPath);
      expect(!!direct.error, "outsider byte read denied");
    }, results);

    await check("signed photo URL expires", async () => {
      const signed = checked(await member.client.storage.from(BUCKET).createSignedUrl(attachedPath, 2), "mint short signed URL");
      expect(!!signed?.signedUrl, "short signed URL minted");
      await new Promise((resolve) => setTimeout(resolve, 3_500));
      const response = await fetch(signed.signedUrl, { cache: "no-store" });
      expect(!response.ok, "expired signed URL denied");
    }, results);

    await check("outsider cannot read committed visit details", async () => {
      const visitId = visit.visitId;
      for (const table of ["visits", "visit_participants", "visit_photos", "activities"]) {
        const column = table === "visits" ? "id" : "visit_id";
        const rows = checked(await outsider.client.from(table).select("*").eq(column, visitId), `outsider ${table} read`);
        expect(rows?.length === 0, `outsider ${table} read`);
      }
    }, results);

    await check("Circle summaries stay isolated", async () => {
      checked(await owner.client.from("group_saved_cafes").insert({ group_id: groupB, cafe_id: owned.cafeId, saved_by: owner.id }), "save cafe in Circle B");
      const aRows = checked(await member.client.rpc("circle_cafe_summaries", { p_group_id: groupA }), "Circle A summary");
      const bRows = checked(await owner.client.rpc("circle_cafe_summaries", { p_group_id: groupB }), "Circle B summary");
      expect(aRows?.length === 1 && Number(aRows[0].visit_count) === 1 && Number(aRows[0].photo_count) === 1 && Number(aRows[0].rating) === 0, "Circle A summary");
      expect(bRows?.length === 1 && Number(bRows[0].visit_count) === 0 && bRows[0].rating === null, "Circle B summary");
    }, results);

    await check("leaving revokes photo permission and fresh signed URLs", async () => {
      const ownerLeave = await owner.client.rpc("leave_circle", { p_group_id: groupA });
      const memberDelete = await member.client.rpc("delete_circle", { p_group_id: groupA });
      expect(!!ownerLeave.error && !!memberDelete.error, "Circle lifecycle permissions");
      const left = checked(await member.client.rpc("leave_circle", { p_group_id: groupA }), "leave Circle A");
      expect(left?.left === true, "member leaves Circle A");
      const allowed = checked(await member.client.rpc("can_read_visit_photo", { p_path: attachedPath }), "former member photo permission");
      expect(allowed === false, "former member photo permission revoked");
      const signed = await member.client.storage.from(BUCKET).createSignedUrl(attachedPath, 60);
      expect(!!signed.error, "former member signed URL denied");
    }, results);
  } catch (error) {
    workError = error;
  } finally {
    // Remove only IDs and paths produced in this run. Each failure remains visible.
    if (owner) {
      for (const id of [...owned.circles].reverse()) {
        try {
          const result = await owner.client.rpc("delete_circle", { p_group_id: id });
          checked(result, "delete owned Circle");
          expect(result.data?.deleted === true, "delete owned Circle");
        } catch { cleanupErrors.push("Circle cleanup"); }
      }
    } else if (owned.circles.length) cleanupErrors.push("Circle cleanup");
    const removedPaths = new Set();
    for (const path of owned.paths) {
      try {
        checked(await admin.storage.from(BUCKET).remove([path]), "remove owned photo");
        await assertObjectAbsent(path, "remove owned photo");
        removedPaths.add(path);
      }
      catch { cleanupErrors.push("Storage cleanup"); }
    }
    for (const path of removedPaths) {
      try { checked(await admin.from("photo_attachment_locks").delete().eq("storage_path", path), "remove owned photo lock"); }
      catch { cleanupErrors.push("photo lock cleanup"); }
    }
    if (owned.cafeId) {
      try {
        const removed = checked(await admin.from("cafes").delete().eq("id", owned.cafeId).select("id"), "remove fixture cafe");
        expect(removed?.length === 1, "remove fixture cafe");
      }
      catch { cleanupErrors.push("cafe cleanup"); }
    }
    if (owned.users.length) {
      try { checked(await admin.from("places_quota_window").delete().in("user_id", owned.users), "remove owned Places quota"); }
      catch { cleanupErrors.push("Places quota cleanup"); }
    }
    for (const id of [...owned.users].reverse()) {
      try { checked(await admin.auth.admin.deleteUser(id), "remove test user"); }
      catch { cleanupErrors.push("account cleanup"); }
    }
    if (cleanupErrors.length === 0) {
      try { await rm(journalPath); }
      catch { cleanupErrors.push("journal cleanup"); }
    }
    console.log(`Cleanup: ${owned.circles.length} Circles, ${owned.paths.length} photo paths, ${owned.cafeId ? 1 : 0} cafe, ${owned.users.length} accounts attempted; ${cleanupErrors.length} failures.`);
    if (cleanupErrors.length) console.log(`Recovery journal: ${journalPath}`);
  }
  if (workError || cleanupErrors.length) throw new Error(`${workError?.message || "Hosted checks passed"}; cleanup failures: ${cleanupErrors.join(", ") || "none"}`);
  console.log(`Hosted acceptance: ${results.length} checks passed. Signup email delivery, OAuth, GPS, and provider permissions were not covered.`);
  return { checks: results.length, cleanupFailures: 0 };
}

async function main() {
  const config = getConfig(process.argv.slice(2));
  if (!config.apply) {
    console.log("Dry run: configuration and target URL valid. No HTTP request or mutation made. Use --apply --project-ref vhkxhfwkrhwqxbndtays for hosted acceptance.");
    return;
  }
  const { createClient } = await import("@supabase/supabase-js");
  await runHosted(config, createClient);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Hosted acceptance failed: ${error instanceof Error ? error.message : "unknown failure"}`);
    process.exitCode = 1;
  });
}
