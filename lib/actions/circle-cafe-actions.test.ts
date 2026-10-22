import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCircleCafeSummariesAction } from "./circle-cafe-actions";

const { rpc, getUser, profiles } = vi.hoisted(() => ({
  rpc: vi.fn(), getUser: vi.fn(), profiles: vi.fn(),
}));
vi.mock("@/lib/supabase/config", () => ({ hasSupabaseConfig: () => true }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser }, rpc,
    from: () => ({ select: () => ({ in: profiles }) }),
  }),
}));

beforeEach(() => {
  getUser.mockResolvedValue({ data: { user: { id: "member" } }, error: null });
  profiles.mockResolvedValue({ data: [{ id: "member", username: "member", display_name: "Member", avatar_url: null }], error: null });
  rpc.mockResolvedValue({ data: [{
    cafe_id: "internal-cafe", provider_place_id: "provider-cafe", name: "Cafe",
    lat: 14.4, lng: 120.9, interested_members: ["member"],
    visit_count: 2, photo_count: 1, rating: 0, rating_count: 1,
  }], error: null });
});

describe("Circle café summaries", () => {
  it("uses the requested Circle, separates café IDs, and preserves a zero rating", async () => {
    const [summary] = await getCircleCafeSummariesAction("circle-a");
    expect(rpc).toHaveBeenCalledWith("circle_cafe_summaries", { p_group_id: "circle-a" });
    expect(summary).toMatchObject({ internalId: "internal-cafe", providerId: "provider-cafe", coordinates: [120.9, 14.4], rating: 0, visitCount: 2 });
    expect(summary.interestedMembers[0].id).toBe("member");
  });

  it("surfaces authorization errors instead of a healthy empty Circle", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Circle membership required" } });
    await expect(getCircleCafeSummariesAction("circle-b")).rejects.toThrow("Circle membership required");
  });

  it("requires an authenticated session", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(getCircleCafeSummariesAction("circle-a")).rejects.toThrow("Not authenticated");
  });
});
