import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addCafe, addUser, asUser, createDatabase, type Database } from "./database-harness";

const OWNER = "10000000-0000-4000-8000-000000000001";
const MEMBER = "10000000-0000-4000-8000-000000000002";
const OUTSIDER = "10000000-0000-4000-8000-000000000003";
const PHOTO_ID = "40000000-0000-4000-8000-000000000001";

describe("circle baseline on local PostgreSQL", () => {
  let db: Database;

  beforeEach(async () => {
    db = await createDatabase();
    await addUser(db, OWNER, "owner_one");
    await addUser(db, MEMBER, "member_one");
    await addUser(db, OUTSIDER, "outsider_one");
  }, 30_000);

  afterEach(async () => {
    await db?.close();
  });

  async function createCircle(actor: string, name: string) {
    return asUser(db, actor, async () => {
      const result = await db.query<{ circle: { groupId: string; inviteCode: string } }>(
        "select public.create_circle($1, null) as circle",
        [name],
      );
      return result.rows[0].circle;
    });
  }

  async function createVisit(actor: string, input: Record<string, unknown>) {
    return asUser(db, actor, async () => {
      const result = await db.query<{ visit: { visitId: string } }>(
        "select public.create_circle_visit($1::jsonb) as visit",
        [JSON.stringify(input)],
      );
      return result.rows[0].visit;
    });
  }

  it("applies the baseline and creates independent owner memberships", async () => {
    const a = await createCircle(OWNER, "A");
    const b = await createCircle(MEMBER, "B");
    expect(a.groupId).not.toBe(b.groupId);
    const rows = await db.query<{ group_id: string; user_id: string; role: string }>(
      "select group_id,user_id,role from public.group_members order by user_id",
    );
    expect(rows.rows).toEqual([
      { group_id: a.groupId, user_id: OWNER, role: "owner" },
      { group_id: b.groupId, user_id: MEMBER, role: "owner" },
    ]);
  });

  it("limits invite preview to name and member count, and joins idempotently", async () => {
    const a = await createCircle(OWNER, "Alpha");
    await asUser(db, MEMBER, async () => {
      const preview = await db.query<{ preview: unknown }>(
        "select public.preview_circle_invite($1) as preview", [a.inviteCode],
      );
      expect(preview.rows[0].preview).toEqual({ name: "Alpha", memberCount: 1 });
      const first = await db.query<{ joined: unknown }>("select public.join_circle($1) as joined", [a.inviteCode]);
      const second = await db.query<{ joined: unknown }>("select public.join_circle($1) as joined", [a.inviteCode]);
      expect(first.rows[0].joined).toEqual({ groupId: a.groupId });
      expect(second.rows[0].joined).toEqual(first.rows[0].joined);
    });
    const count = await db.query<{ count: number }>(
      "select count(*)::int as count from public.group_members where group_id=$1", [a.groupId],
    );
    expect(count.rows[0].count).toBe(2);
  });

  it("prevents outsiders from reading or injecting Circle visits and membership", async () => {
    const a = await createCircle(OWNER, "Alpha");
    const cafe = await addCafe(db, "place-one");
    await createVisit(OWNER, { groupId: a.groupId, cafeId: cafe, visitedAt: "2026-10-16" });
    await asUser(db, OUTSIDER, async () => {
      expect((await db.query("select * from public.groups")).rows).toEqual([]);
      expect((await db.query("select * from public.group_members")).rows).toEqual([]);
      expect((await db.query("select * from public.visits")).rows).toEqual([]);
      await expect(db.query(
        "insert into public.group_members(group_id,user_id,role) values ($1,$2,'member')",
        [a.groupId, OUTSIDER],
      )).rejects.toMatchObject({ code: "42501" });
      await expect(db.query(
        "select public.create_circle_visit($1::jsonb)",
        [JSON.stringify({ groupId: a.groupId, cafeId: cafe, visitedAt: "2026-10-16" })],
      )).rejects.toMatchObject({ code: "42501" });
    });
  });

  it("keeps owner in Circle while permitting a joined member to leave", async () => {
    const a = await createCircle(OWNER, "Alpha");
    await asUser(db, MEMBER, () => db.query("select public.join_circle($1)", [a.inviteCode]));
    await asUser(db, OWNER, async () => {
      await expect(db.query("select public.leave_circle($1::uuid)", [a.groupId]))
        .rejects.toMatchObject({ code: "42501" });
    });
    await asUser(db, MEMBER, () => db.query("select public.leave_circle($1::uuid)", [a.groupId]));
    const members = await db.query<{ user_id: string }>(
      "select user_id from public.group_members where group_id=$1", [a.groupId],
    );
    expect(members.rows).toEqual([{ user_id: OWNER }]);
  });

  it("isolates A/B summaries and returns zero visits for a saved cafe", async () => {
    const a = await createCircle(OWNER, "Alpha");
    const b = await createCircle(MEMBER, "Beta");
    const cafe = await addCafe(db, "place-one");
    await createVisit(OWNER, { groupId: a.groupId, cafeId: cafe, visitedAt: "2026-10-16", rating: 4.5 });
    await asUser(db, MEMBER, () => db.query(
      "insert into public.group_saved_cafes(group_id,cafe_id,saved_by) values ($1,$2,$3)",
      [b.groupId, cafe, MEMBER],
    ));
    const aRows = await asUser(db, OWNER, () => db.query<{ visit_count: number; rating: string }>(
      "select visit_count,rating from public.circle_cafe_summaries($1::uuid)", [a.groupId],
    ));
    const bRows = await asUser(db, MEMBER, () => db.query<{ visit_count: number; rating: string | null }>(
      "select visit_count,rating from public.circle_cafe_summaries($1::uuid)", [b.groupId],
    ));
    expect(aRows.rows).toEqual([{ visit_count: 1, rating: "4.5" }]);
    expect(bRows.rows).toEqual([{ visit_count: 0, rating: null }]);
    await asUser(db, OUTSIDER, async () => {
      await expect(db.query("select * from public.circle_cafe_summaries($1::uuid)", [a.groupId]))
        .rejects.toMatchObject({ code: "42501" });
    });
  });

  it("keeps one shared save and activity after a duplicate attempt by another member", async () => {
    const circle = await createCircle(OWNER, "Alpha");
    const cafe = await addCafe(db, "shared-save-place");
    await asUser(db, MEMBER, () => db.query("select public.join_circle($1)", [circle.inviteCode]));
    const insert = "insert into public.group_saved_cafes(group_id,cafe_id,saved_by) values ($1,$2,$3)";
    await asUser(db, OWNER, () => db.query(insert, [circle.groupId, cafe, OWNER]));
    await asUser(db, MEMBER, async () => {
      await expect(db.query(insert, [circle.groupId, cafe, MEMBER]))
        .rejects.toMatchObject({ code: "23505" });
    });
    const saves = await db.query<{ saved_by: string }>(
      "select saved_by from public.group_saved_cafes where group_id=$1 and cafe_id=$2",
      [circle.groupId, cafe],
    );
    expect(saves.rows).toEqual([{ saved_by: OWNER }]);
    const activities = await db.query<{ count: number }>(
      "select count(*)::int as count from public.activities where group_id=$1 and cafe_id=$2 and type='save'",
      [circle.groupId, cafe],
    );
    expect(activities.rows).toEqual([{ count: 1 }]);
  });

  it("rolls back invalid participants without a visit or activity", async () => {
    const a = await createCircle(OWNER, "Alpha");
    const cafe = await addCafe(db, "place-one");
    await expect(createVisit(OWNER, {
      groupId: a.groupId, cafeId: cafe, visitedAt: "2026-10-16", participants: [OUTSIDER],
    })).rejects.toMatchObject({ code: "22023" });
    expect((await db.query("select * from public.visits")).rows).toEqual([]);
    expect((await db.query("select * from public.activities")).rows).toEqual([]);
  });

  it("removes a departing member from Circle interest summaries", async () => {
    const a = await createCircle(OWNER, "Alpha");
    const cafe = await addCafe(db, "place-one");
    await asUser(db, OWNER, () => db.query(
      "insert into public.group_saved_cafes(group_id,cafe_id,saved_by) values ($1,$2,$3)",
      [a.groupId, cafe, OWNER],
    ));
    await asUser(db, MEMBER, () => db.query("select public.join_circle($1)", [a.inviteCode]));
    await asUser(db, MEMBER, () => db.query(
      "insert into public.cafe_interests(group_id,cafe_id,user_id) values ($1,$2,$3)",
      [a.groupId, cafe, MEMBER],
    ));
    await asUser(db, MEMBER, () => db.query("select public.leave_circle($1::uuid)", [a.groupId]));
    const summaries = await asUser(db, OWNER, () => db.query<{ interested_members: string[] }>(
      "select interested_members from public.circle_cafe_summaries($1::uuid)", [a.groupId],
    ));
    expect(summaries.rows).toEqual([{ interested_members: [] }]);
  });

  it("lets current members revise Circle hours even after the previous submitter leaves", async () => {
    const a = await createCircle(OWNER, "Alpha");
    const cafe = await addCafe(db, "place-one");
    await asUser(db, MEMBER, () => db.query("select public.join_circle($1)", [a.inviteCode]));
    await asUser(db, OWNER, () => db.query(
      "insert into public.circle_cafe_hours(group_id,cafe_id,day_of_week,open_time,close_time,submitted_by) values ($1,$2,1,'09:00','17:00',$3)",
      [a.groupId, cafe, OWNER],
    ));
    await asUser(db, MEMBER, () => db.query(
      `insert into public.circle_cafe_hours(group_id,cafe_id,day_of_week,open_time,close_time,submitted_by)
       values ($1,$2,1,'10:00','18:00',$3)
       on conflict(group_id,cafe_id,day_of_week) do update
       set open_time=excluded.open_time,close_time=excluded.close_time,submitted_by=excluded.submitted_by`,
      [a.groupId, cafe, MEMBER],
    ));
    const memberRevision = await db.query<{ open_time: string; submitted_by: string }>(
      "select open_time,submitted_by from public.circle_cafe_hours where group_id=$1", [a.groupId],
    );
    expect(memberRevision.rows).toEqual([{ open_time: "10:00:00", submitted_by: MEMBER }]);
    await asUser(db, MEMBER, () => db.query("select public.leave_circle($1::uuid)", [a.groupId]));
    await asUser(db, OWNER, () => db.query(
      `update public.circle_cafe_hours set open_time='08:00',submitted_by=$1
       where group_id=$2 and cafe_id=$3 and day_of_week=1`,
      [OWNER, a.groupId, cafe],
    ));
    const rows = await db.query<{ open_time: string; submitted_by: string }>(
      "select open_time,submitted_by from public.circle_cafe_hours where group_id=$1", [a.groupId],
    );
    expect(rows.rows).toEqual([{ open_time: "08:00:00", submitted_by: OWNER }]);
  });

  it("keeps deleted-Circle photo bytes inaccessible to their original uploader", async () => {
    const b = await createCircle(MEMBER, "Beta");
    const cafe = await addCafe(db, "place-one");
    const path = `${MEMBER}/40000000-0000-4000-8000-000000000003.jpg`;
    await asUser(db, MEMBER, () => db.query(
      "insert into storage.objects(bucket_id,name,owner_id) values ('visit-photos',$1,$2)",
      [path, MEMBER],
    ));
    await createVisit(MEMBER, {
      groupId: b.groupId, cafeId: cafe, visitedAt: "2026-10-16",
      photos: [{ storagePath: path }],
    });
    await asUser(db, MEMBER, () => db.query("select public.delete_circle($1::uuid)", [b.groupId]));
    await asUser(db, MEMBER, async () => {
      expect((await db.query("select name from storage.objects where name=$1", [path])).rows).toEqual([]);
      expect((await db.query("delete from storage.objects where name=$1 returning id", [path])).rows).toEqual([]);
    });
    const object = await db.query<{ name: string }>("select name from storage.objects where name=$1", [path]);
    expect(object.rows).toEqual([{ name: path }]);
  });

  it("protects private photos, attached objects, and former members", async () => {
    const a = await createCircle(OWNER, "Alpha");
    const cafe = await addCafe(db, "place-one");
    const path = `${OWNER}/${PHOTO_ID}.png`;
    await asUser(db, OWNER, () => db.query(
      "insert into storage.objects(bucket_id,name,owner_id) values ('visit-photos',$1,$2)", [path, OWNER],
    ));
    await asUser(db, OUTSIDER, async () => {
      expect((await db.query("select * from storage.objects where name=$1", [path])).rows).toEqual([]);
      expect((await db.query("delete from storage.objects where name=$1 returning id", [path])).rows).toEqual([]);
      await expect(db.query(
        "insert into storage.objects(bucket_id,name,owner_id) values ('visit-photos',$1,$2)",
        [`${OUTSIDER}/${PHOTO_ID}.png`, OWNER],
      )).rejects.toMatchObject({ code: "42501" });
    });
    await asUser(db, MEMBER, () => db.query("select public.join_circle($1)", [a.inviteCode]));
    await asUser(db, MEMBER, async () => {
      expect((await db.query("select name from storage.objects where name=$1", [path])).rows).toEqual([]);
    });
    await createVisit(OWNER, {
      groupId: a.groupId, cafeId: cafe, visitedAt: "2026-10-16",
      photos: [{ storagePath: path, caption: "Visit" }],
    });
    await asUser(db, MEMBER, async () => {
      expect((await db.query("select name from storage.objects where name=$1", [path])).rows)
        .toEqual([{ name: path }]);
    });
    await asUser(db, OWNER, async () => {
      expect((await db.query("delete from storage.objects where name=$1 returning id", [path])).rows).toEqual([]);
    });
    const memberPath = `${MEMBER}/40000000-0000-4000-8000-000000000002.webp`;
    await asUser(db, MEMBER, () => db.query(
      "insert into storage.objects(bucket_id,name,owner_id) values ('visit-photos',$1,$2)",
      [memberPath, MEMBER],
    ));
    await createVisit(MEMBER, {
      groupId: a.groupId, cafeId: cafe, visitedAt: "2026-10-16",
      photos: [{ storagePath: memberPath }],
    });
    await asUser(db, MEMBER, async () => {
      expect((await db.query("delete from storage.objects where name=$1 returning id", [memberPath])).rows)
        .toEqual([]);
    });
    await asUser(db, MEMBER, () => db.query("select public.leave_circle($1::uuid)", [a.groupId]));
    await asUser(db, MEMBER, async () => {
      expect((await db.query("select name from storage.objects where name=$1", [path])).rows).toEqual([]);
      expect((await db.query("select name from storage.objects where name=$1", [memberPath])).rows).toEqual([]);
      expect((await db.query("delete from storage.objects where name=$1 returning id", [memberPath])).rows).toEqual([]);
    });
  });

  it("makes a deletion claim exclude attachment and denies direct Storage deletion", async () => {
    const a = await createCircle(OWNER, "Alpha");
    const cafe = await addCafe(db, "place-race");
    const deletingPath = `${OWNER}/40000000-0000-4000-8000-000000000010.jpg`;
    const attachedPath = `${OWNER}/40000000-0000-4000-8000-000000000011.jpg`;
    await asUser(db, OWNER, () => db.query(
      "insert into storage.objects(bucket_id,name,owner_id) values ('visit-photos',$1,$3),('visit-photos',$2,$3)",
      [deletingPath, attachedPath, OWNER],
    ));
    await asUser(db, OWNER, async () => {
      expect((await db.query("delete from storage.objects where name=$1 returning id", [deletingPath])).rows).toEqual([]);
      const claim = await db.query<{ claimed: boolean }>(
        "select public.claim_temporary_photo_delete($1) as claimed", [deletingPath],
      );
      expect(claim.rows[0].claimed).toBe(true);
      const retry = await db.query<{ claimed: boolean }>(
        "select public.claim_temporary_photo_delete($1) as claimed", [deletingPath],
      );
      expect(retry.rows[0].claimed).toBe(true);
    });
    await asUser(db, OUTSIDER, async () => {
      await expect(db.query("select public.claim_temporary_photo_delete($1)", [deletingPath]))
        .rejects.toMatchObject({ code: "42501" });
    });
    await expect(createVisit(OWNER, {
      groupId: a.groupId, cafeId: cafe, visitedAt: "2026-10-16",
      photos: [{ storagePath: deletingPath }],
    })).rejects.toMatchObject({ code: "22023" });
    await createVisit(OWNER, {
      groupId: a.groupId, cafeId: cafe, visitedAt: "2026-10-16",
      photos: [{ storagePath: attachedPath }],
    });
    await asUser(db, OWNER, async () => {
      const claim = await db.query<{ claimed: boolean }>(
        "select public.claim_temporary_photo_delete($1) as claimed", [attachedPath],
      );
      expect(claim.rows[0].claimed).toBe(false);
    });
  });
});
