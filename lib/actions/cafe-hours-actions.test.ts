import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveCircleCafeHoursAction } from "./cafe-hours-actions";

const { getUser, membership, cafeRecord, upsert, upsertCafeAction } = vi.hoisted(() => ({
  getUser: vi.fn(),
  membership: vi.fn(),
  cafeRecord: vi.fn(),
  upsert: vi.fn(),
  upsertCafeAction: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ hasSupabaseConfig: () => true }));
vi.mock("./cafe-actions", () => ({ upsertCafeAction }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: (table: string) => {
      if (table === "group_members") return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: membership }) }) }) };
      if (table === "cafes") return { select: () => ({ eq: () => ({ maybeSingle: cafeRecord }) }) };
      if (table === "circle_cafe_hours") return { upsert };
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

const groupId = "20000000-0000-4000-8000-000000000001";
const cafeId = "10000000-0000-4000-8000-000000000001";
const cafe = { id: "mapbox-cafe", name: "Test", coordinates: [120, 14], address: "A" } as const;
const hours = Array.from({ length: 7 }, (_, day_of_week) => ({
  day_of_week, open_time: "08:00", close_time: "17:00", is_closed: false,
}));

beforeEach(() => {
  vi.resetAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "actor" } }, error: null });
  membership.mockResolvedValue({ data: { user_id: "actor" }, error: null });
  upsertCafeAction.mockResolvedValue({ success: true, cafeId });
  cafeRecord.mockResolvedValue({ data: { timezone: "Asia/Manila" }, error: null });
  upsert.mockResolvedValue({ error: null });
});

describe("saveCircleCafeHoursAction", () => {
  it.each([
    [hours.slice(0, 6), "seven"],
    [[...hours.slice(0, 6), hours[0]], "unique"],
    [[{ ...hours[0], day_of_week: 7 }, ...hours.slice(1)], "day"],
    [[{ ...hours[0], open_time: "25:00" }, ...hours.slice(1)], "time"],
    [[{ ...hours[0], close_time: "08:00" }, ...hours.slice(1)], "time"],
  ])("rejects invalid hours before ingestion: %j", async (bad, message) => {
    const result = await saveCircleCafeHoursAction(groupId, cafe as never, bad);
    expect(result.success).toBe(false);
    expect(result.error?.toLowerCase()).toContain(message);
    expect(upsertCafeAction).not.toHaveBeenCalled();
  });

  it("rejects a nonmember before café ingestion", async () => {
    membership.mockResolvedValue({ data: null, error: null });
    const result = await saveCircleCafeHoursAction(groupId, cafe as never, hours);
    expect(result.success).toBe(false);
    expect(upsertCafeAction).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("stores the canonical café timezone on every day", async () => {
    expect(await saveCircleCafeHoursAction(groupId, cafe as never, hours)).toEqual({ success: true });
    expect(upsert).toHaveBeenCalledOnce();
    const rows = upsert.mock.calls[0][0] as Array<{ timezone: string }>;
    expect(rows).toHaveLength(7);
    expect(rows.every((row) => row.timezone === "Asia/Manila")).toBe(true);
  });

  it("stores closed days without invalid empty time values", async () => {
    await saveCircleCafeHoursAction(groupId, cafe as never, [
      { ...hours[0], is_closed: true, open_time: "", close_time: "" }, ...hours.slice(1),
    ]);
    expect(upsert.mock.calls[0][0][0]).toMatchObject({
      is_closed: true, open_time: null, close_time: null,
    });
  });
});
