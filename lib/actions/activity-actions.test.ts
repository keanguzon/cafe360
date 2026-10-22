import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getFriendActivitiesAction,
  getGroupActivitiesAction,
  logActivityAction,
  getGroupRelationshipStatsAction,
} from "./activity-actions";

const {
  hasSupabaseConfigMock,
  getUserMock,
  cafeLookupMock,
  groupSavedEqGroupMock,
  visitsEqGroupMock,
  savedCafesSelectMock,
} = vi.hoisted(() => ({
  hasSupabaseConfigMock: vi.fn(() => false),
  getUserMock: vi.fn(),
  cafeLookupMock: vi.fn(),
  groupSavedEqGroupMock: vi.fn(),
  visitsEqGroupMock: vi.fn(),
  savedCafesSelectMock: vi.fn(),
}));

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseConfig: () => hasSupabaseConfigMock(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (table === "cafes") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: cafeLookupMock,
            }),
          }),
        };
      }
      if (table === "group_saved_cafes") {
        return {
          select: () => ({
            eq: () => ({
              eq: groupSavedEqGroupMock,
            }),
          }),
        };
      }
      if (table === "visits") {
        return {
          select: () => ({
            eq: () => ({
              eq: visitsEqGroupMock,
            }),
          }),
        };
      }
      if (table === "saved_cafes") {
        return { select: savedCafesSelectMock };
      }
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      };
    },
  }),
}));

describe("activity-actions (demo / fallback mode)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasSupabaseConfigMock.mockReturnValue(false);
  });

  it("fetches friend activities feed", async () => {
    const activities = await getFriendActivitiesAction(10, 0);
    expect(Array.isArray(activities)).toBe(true);
    expect(activities.length).toBeGreaterThan(0);
    expect(activities[0]).toHaveProperty("type");
    expect(activities[0]).toHaveProperty("user_id");
  });

  it("fetches group activities feed", async () => {
    const activities = await getGroupActivitiesAction("demo-group-1", 10, 0);
    expect(Array.isArray(activities)).toBe(true);
  });

  it("logs an activity in demo mode", async () => {
    const result = await logActivityAction({
      type: "save",
      cafe_id: "demo-cafe-1",
      metadata: { note: "Great matcha" },
    });
    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();

    const activities = await getFriendActivitiesAction(10, 0);
    const found = activities.find((a) => a.id === result.id);
    expect(found).toBeDefined();
    expect(found?.type).toBe("save");
  });

  it("calculates group relationship stats for a cafe", async () => {
    const stats = await getGroupRelationshipStatsAction("demo-cafe-1", "demo-group-1");
    expect(stats).toBeDefined();
    expect(typeof stats.savedCount).toBe("number");
    expect(typeof stats.visitCount).toBe("number");
    expect(Array.isArray(stats.savedByFriends)).toBe(true);
    expect(Array.isArray(stats.visitedByFriends)).toBe(true);
  });
});

describe("getGroupRelationshipStatsAction (Supabase mode)", () => {
  const internalCafeId = "10000000-0000-4000-8000-000000000001";
  const groupId = "20000000-0000-4000-8000-000000000001";

  beforeEach(() => {
    vi.clearAllMocks();
    hasSupabaseConfigMock.mockReturnValue(true);
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    cafeLookupMock.mockResolvedValue({ data: { id: internalCafeId }, error: null });
    groupSavedEqGroupMock.mockResolvedValue({
      data: [
        {
          added_by: "user-2",
          profiles: { id: "user-2", username: "ana", display_name: "Ana", avatar_url: null },
        },
      ],
      error: null,
    });
    visitsEqGroupMock.mockResolvedValue({
      data: [
        {
          rating: 0,
          created_by: "user-1",
          profiles: { id: "user-1", username: "me", display_name: "Me", avatar_url: null },
        },
        {
          rating: 4,
          created_by: "user-2",
          profiles: { id: "user-2", username: "ana", display_name: "Ana", avatar_url: null },
        },
      ],
      error: null,
    });
  });

  it("resolves provider place IDs, queries group_saved_cafes and group-scoped visits, and includes 0 ratings in average", async () => {
    const stats = await getGroupRelationshipStatsAction("mapbox-place-1", groupId);

    expect(savedCafesSelectMock).not.toHaveBeenCalled();
    expect(groupSavedEqGroupMock).toHaveBeenCalledWith("group_id", groupId);
    expect(visitsEqGroupMock).toHaveBeenCalledWith("group_id", groupId);
    expect(stats).toEqual({
      savedCount: 1,
      visitCount: 2,
      averageRating: 2,
      savedByFriends: [{ id: "user-2", username: "ana", display_name: "Ana", avatar_url: null }],
      visitedByFriends: [
        { id: "user-1", username: "me", display_name: "Me", avatar_url: null },
        { id: "user-2", username: "ana", display_name: "Ana", avatar_url: null },
      ],
    });
  });
});
