import { beforeEach, expect, it, vi } from "vitest";
import { toggleSaveCafeAction } from "./cafe-actions";
const m = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn(), ingest: vi.fn(), upsert: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ hasSupabaseConfig: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: m.auth }, from: m.from }) }));
vi.mock("@/lib/data/cafe-repository", () => ({ ingestCafe: m.ingest }));
vi.mock("next/cache", () => ({ revalidatePath: m.refresh }));
const cafe = { id: "provider", name: "Coffee", address: "Road", coordinates: [1, 2] as [number, number] };
beforeEach(() => {
  vi.clearAllMocks(); m.auth.mockResolvedValue({ data: { user: { id: "A" } }, error: null });
  m.ingest.mockResolvedValue({ internalId: "internal" });
  m.upsert.mockReturnValue({ select: () => ({ single: async () => ({ data: { id: "saved" }, error: null }) }) });
  m.from.mockReturnValue({ upsert: m.upsert });
  m.refresh.mockReset();
});
it("rejects an account switch before ingesting or writing", async () => {
  expect(await toggleSaveCafeAction({ cafe, expectedAccountId: "B" })).toEqual({ success: false, error: "Account changed. Please retry." });
  expect(m.ingest).not.toHaveBeenCalled(); expect(m.from).not.toHaveBeenCalled();
});
it("writes for the expected authenticated account", async () => {
  expect(await toggleSaveCafeAction({ cafe, expectedAccountId: "A" })).toMatchObject({ success: true });
  expect(m.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "A", cafe_id: "internal" }), expect.anything());
});
it("reports a committed save when subsequent route refresh fails", async () => {
  m.refresh.mockImplementation((path: string) => { if (path === "/profile") throw new Error("Refresh unavailable"); });
  expect(await toggleSaveCafeAction({ cafe, expectedAccountId: "A" })).toMatchObject({ success: true, isSaved: true, refreshFailed: true });
});
it("reports a committed removal when subsequent route refresh fails", async () => {
  m.refresh.mockImplementation((path: string) => { if (path === "/profile") throw new Error("Refresh unavailable"); });
  const query = { eq: vi.fn(), then: (resolve: (result: { error: null }) => unknown) => Promise.resolve(resolve({ error: null })) };
  query.eq.mockReturnValue(query);
  m.from.mockReturnValue({ delete: () => query });
  expect(await toggleSaveCafeAction({ cafe, expectedAccountId: "A", isSaving: false })).toMatchObject({ success: true, isSaved: false, refreshFailed: true });
});
