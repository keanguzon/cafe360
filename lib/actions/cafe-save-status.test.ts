import { beforeEach, expect, it, vi } from "vitest";
import { getAccountCafeSaveStatusAction } from "./personal-collection-actions";
import { AuthSessionMissingError } from "@supabase/supabase-js";
const m = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn(), eq: vi.fn(), single: vi.fn(), saved: { data: [{ collection: "Trips" }], error: null } as { data: { collection: string }[]; error: { message: string } | null } }));
vi.mock("@/lib/supabase/config", () => ({ hasSupabaseConfig: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: m.auth }, from: m.from }) }));
vi.mock("./cafe-actions", () => ({ getSavedCafesAction: vi.fn(), getUserCollectionsAction: vi.fn(), isCafeSavedAction: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks(); m.auth.mockResolvedValue({ data: { user: { id: "A" } }, error: null });
  m.saved = { data: [{ collection: "Trips" }], error: null };
  m.single.mockResolvedValue({ data: { id: "internal" }, error: null });
  const query = { eq: m.eq, maybeSingle: m.single, then: (resolve: (value: typeof m.saved) => unknown) => Promise.resolve(resolve(m.saved)) };
  m.eq.mockReturnValue(query); m.from.mockReturnValue({ select: () => query });
});
it("reads provider membership only for the verified account with one auth request", async () => {
  expect(await getAccountCafeSaveStatusAction("A", "provider")).toEqual({ ok: true, data: { isSaved: true, collections: ["Trips"] } });
  expect(m.eq).toHaveBeenCalledWith("provider_place_id", "provider");
  expect(m.eq).toHaveBeenCalledWith("user_id", "A"); expect(m.auth).toHaveBeenCalledTimes(1);
});
it("supports internal cafe identifiers", async () => {
  await getAccountCafeSaveStatusAction("A", "00000000-0000-0000-0000-000000000001");
  expect(m.eq).toHaveBeenCalledWith("id", "00000000-0000-0000-0000-000000000001");
});
it("returns a real unsaved result only after a successful empty read", async () => {
  m.saved.data = [];
  expect(await getAccountCafeSaveStatusAction("A", "provider")).toEqual({ ok: true, data: { isSaved: false, collections: [] } });
});
it("does not convert a query failure into an unsaved result", async () => {
  m.single.mockResolvedValue({ data: null, error: { message: "Unavailable" } });
  expect(await getAccountCafeSaveStatusAction("A", "provider")).toEqual({ ok: false, status: 503, error: "Unavailable" });
});
it.each([401, 403])("returns %i before querying private membership", async (status) => {
  m.auth.mockResolvedValue(status === 401 ? { data: { user: null }, error: null } : { data: { user: { id: "B" } }, error: null });
  expect(await getAccountCafeSaveStatusAction("A", "provider")).toMatchObject({ ok: false, status });
  expect(m.from).not.toHaveBeenCalled();
});
it("recognizes the SDK's missing-session error as signed out, not an outage", async () => {
  m.auth.mockResolvedValue({ data: { user: null }, error: new AuthSessionMissingError() });
  expect(await getAccountCafeSaveStatusAction("A", "provider")).toEqual({ ok: false, status: 401, error: "Not authenticated" });
  expect(m.from).not.toHaveBeenCalled();
});
