import { beforeEach, describe, expect, it, vi } from "vitest";
import { createVisitAction, getCircleVisitsAction, getVisitsForCafeAction } from "./visit-actions";

const { rpc, upsertCafeAction, memberLookup, getUser, revalidatePath, visitQuery } = vi.hoisted(() => ({
  rpc: vi.fn(),
  upsertCafeAction: vi.fn(),
  memberLookup: vi.fn(),
  getUser: vi.fn(),
  revalidatePath: vi.fn(),
  visitQuery: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/supabase/config", () => ({ hasSupabaseConfig: () => true }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: (table: string) => {
      if (table === "group_members") return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: memberLookup }) }) }) };
      if (table === "visits") return { select: () => ({ eq: () => ({ eq: () => ({ order: visitQuery }), order: visitQuery }) }) };
      throw new Error(`Unexpected table write: ${table}`);
    },
    rpc,
  }),
}));
vi.mock("./cafe-actions", () => ({ upsertCafeAction }));

const cafeId = "10000000-0000-4000-8000-000000000001";
const groupId = "20000000-0000-4000-8000-000000000001";
const actorId = "30000000-0000-4000-8000-000000000001";
const baseInput = { cafe_id: cafeId, group_id: groupId, visited_at: "2026-10-16" };

beforeEach(() => {
  vi.resetAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: actorId } }, error: null });
  memberLookup.mockResolvedValue({ data: { user_id: actorId }, error: null });
  rpc.mockResolvedValue({ data: { visitId: "visit-id" }, error: null });
  upsertCafeAction.mockResolvedValue({ success: true, cafeId });
  visitQuery.mockResolvedValue({ data: [], error: null });
});

describe("visit reads", () => {
  it("throws query failures instead of reporting an empty Circle", async () => {
    visitQuery.mockResolvedValue({ data: null, error: { message: "database unavailable" } });
    await expect(getCircleVisitsAction(groupId)).rejects.toThrow("database unavailable");
    await expect(getVisitsForCafeAction(cafeId, groupId)).rejects.toThrow("database unavailable");
  });

  it("throws on authentication failure", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(getCircleVisitsAction(groupId)).rejects.toThrow("Unauthorized");
    await expect(getVisitsForCafeAction(cafeId, groupId)).rejects.toThrow("Unauthorized");
  });
});

describe("createVisitAction", () => {
  it("passes zero rating and children to one atomic RPC", async () => {
    const input = { ...baseInput, rating: 0, participant_ids: [actorId], photo_paths: [`${actorId}/a.jpg`] };
    expect(await createVisitAction(input)).toEqual({ success: true, visitId: "visit-id" });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("create_circle_visit", { p_input: {
      groupId, cafeId, visitedAt: "2026-10-16", rating: 0, notes: null,
      participants: [actorId], photos: [{ storagePath: `${actorId}/a.jpg` }],
    } });
  });

  it.each([null, 5])("preserves rating %s", async (rating) => {
    await createVisitAction({ ...baseInput, rating });
    expect(rpc).toHaveBeenCalledWith("create_circle_visit", {
      p_input: expect.objectContaining({ rating }),
    });
  });

  it("rejects unauthenticated writes", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await createVisitAction(baseInput)).toEqual({ success: false, error: "Unauthorized" });
    expect(memberLookup).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a nonmember before café ingestion", async () => {
    memberLookup.mockResolvedValue({ data: null, error: null });
    const result = await createVisitAction({ ...baseInput, cafe_id: "mapbox-id", cafe: { id: "mapbox-id" } as never });
    expect(result.success).toBe(false);
    expect(upsertCafeAction).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects mismatched provider snapshots", async () => {
    const result = await createVisitAction({
      ...baseInput, cafe_id: "provider-one", cafe: { id: "provider-two" } as never,
    });
    expect(result.error).toBe("Café selection mismatch");
    expect(upsertCafeAction).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns failure when the transaction rejects a child write", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Participant is not a Circle member" } });
    const result = await createVisitAction({ ...baseInput, participant_ids: [actorId] });
    expect(result).toEqual({ success: false, error: "Participant is not a Circle member" });
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("does not report a committed visit as failed if cache revalidation throws", async () => {
    revalidatePath.mockImplementation(() => { throw new Error("cache unavailable"); });
    expect(await createVisitAction(baseInput)).toEqual({ success: true, visitId: "visit-id" });
  });

  it.each([
    [{ visited_at: "2026-02-30" }, "date"],
    [{ rating: -1 }, "rating"],
    [{ rating: 5.5 }, "rating"],
    [{ notes: "x".repeat(1001) }, "notes"],
    [{ participant_ids: Array(6).fill(actorId) }, "participants"],
    [{ participant_ids: [actorId, actorId] }, "participants"],
    [{ photo_paths: Array(6).fill("path") }, "photos"],
  ])("rejects invalid visit fields before RPC: %j", async (change, message) => {
    const result = await createVisitAction({ ...baseInput, ...change });
    expect(result.success).toBe(false);
    expect(result.error?.toLowerCase()).toContain(message);
    expect(rpc).not.toHaveBeenCalled();
  });
});
