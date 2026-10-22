import { beforeEach, describe, it, expect, vi } from "vitest";
import { getPersonalStats, getGroupStats } from "./stats-service";

const { visitsEq, visitsIn, savesEq, membersEq } = vi.hoisted(() => ({
  visitsEq: vi.fn(),
  visitsIn: vi.fn(),
  savesEq: vi.fn(),
  membersEq: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "visits") {
        return {
          select: vi.fn().mockReturnValue({
            eq: visitsEq,
            in: visitsIn,
          }),
        };
      }
      if (table === "saved_cafes") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 12, data: [], error: null }),
          }),
        };
      }
      if (table === "group_saved_cafes") {
        return {
          select: vi.fn().mockReturnValue({
            eq: savesEq,
          }),
        };
      }
      if (table === "visit_photos") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 3, data: [], error: null }),
          }),
        };
      }
      if (table === "group_members") {
        return {
          select: vi.fn().mockReturnValue({
            eq: membersEq,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ count: 0, data: [], error: null }),
      };
    }),
  }),
}));

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseConfig: vi.fn().mockReturnValue(true),
}));

describe("Stats Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    visitsEq.mockResolvedValue({ count: 5, data: [{ cafe_id: "cafe-1", rating: 5 }], error: null });
    visitsIn.mockResolvedValue({ count: 99, data: [], error: null });
    savesEq.mockResolvedValue({ count: 4, data: [], error: null });
    membersEq.mockResolvedValue({
      count: 2,
      data: [{ user_id: "user-1" }, { user_id: "user-2" }],
      error: null,
    });
  });

  it("should fetch personal stats correctly", async () => {
    const result = await getPersonalStats();
    expect(result.visits).toBe(5);
    expect(result.saved).toBe(12);
    expect(result.photos).toBe(3);
    expect(result.groups).toBe(2);
  });

  it("scopes group stats visits strictly to group_id instead of member created_by across circles", async () => {
    const result = await getGroupStats("group-1");
    expect(visitsEq).toHaveBeenCalledWith("group_id", "group-1");
    expect(visitsIn).not.toHaveBeenCalled();
    expect(result).toEqual({
      totalVisits: 5,
      totalSaves: 4,
      memberCount: 2,
    });
  });
});
