import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSavedCafesAction, getUserCollectionsAction } from "./cafe-actions";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
}));
vi.mock("@/lib/supabase/config", () => ({ hasSupabaseConfig: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser }, from: mocks.from }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "account-1" } }, error: null });
  mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: null, error: { message: "Saved cafés unavailable" } }) }) }) });
});

describe("personal collection reads", () => {
  it("keeps global compatibility ratings out of saved cafés and preserves canonical identity", async () => {
    mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [{
      id: "save", user_id: "account-1", cafe_id: "internal", collection: "Favorites", notes: null, created_at: "2026-10-16",
      cafes: { id: "internal", provider_place_id: "provider", name: "Cafe", address: "Bacoor", lat: 14, lng: 120, community_rating: 4.9, community_rating_count: 500, price_level: null },
    }], error: null }) }) }) });
    const [saved] = await getSavedCafesAction();
    expect(saved.cafe).toMatchObject({ id: "provider", internalId: "internal", coordinates: [120, 14] });
    expect(saved.cafe?.rating).toBeUndefined();
    expect(saved.cafe?.priceLevel).toBeUndefined();
  });
  it("reports a saved-café query failure", async () => {
    await expect(getSavedCafesAction()).rejects.toThrow("Saved cafés unavailable");
  });
  it("reports a collection summary query failure", async () => {
    await expect(getUserCollectionsAction()).rejects.toThrow("Saved cafés unavailable");
  });
  it("reports an expired session rather than an empty collection", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(getSavedCafesAction()).rejects.toThrow("Not authenticated");
    await expect(getUserCollectionsAction()).rejects.toThrow("Not authenticated");
  });
});
