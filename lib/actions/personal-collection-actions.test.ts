import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAccountCollectionsAction, getAccountSavedCafesAction } from "./personal-collection-actions";

const mocks = vi.hoisted(() => ({ configured: true, getUser: vi.fn(), collections: vi.fn(), saved: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ hasSupabaseConfig: () => mocks.configured }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("./cafe-actions", () => ({ getUserCollectionsAction: mocks.collections, getSavedCafesAction: mocks.saved }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.configured = true;
  mocks.getUser.mockResolvedValue({ data: { user: { id: "account-A" } }, error: null });
  mocks.collections.mockResolvedValue([{ name: "Favorites" }]);
  mocks.saved.mockResolvedValue([{ id: "save-A" }]);
});

describe("account-bound personal collection reads", () => {
  it("loads only after verifying the expected actor", async () => {
    expect(await getAccountCollectionsAction("account-A")).toEqual({ ok: true, data: [{ name: "Favorites" }] });
    expect(await getAccountSavedCafesAction("account-A", "Favorites")).toEqual({ ok: true, data: [{ id: "save-A" }] });
    expect(mocks.saved).toHaveBeenCalledWith("Favorites");
  });

  it("returns 401 and skips reads when auth expires", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await getAccountCollectionsAction("account-A")).toEqual({ ok: false, status: 401, error: "Not authenticated" });
    expect(await getAccountSavedCafesAction("account-A", "Favorites")).toEqual({ ok: false, status: 401, error: "Not authenticated" });
    expect(mocks.collections).not.toHaveBeenCalled();
    expect(mocks.saved).not.toHaveBeenCalled();
  });

  it("returns 403 and skips reads after account change", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "account-B" } }, error: null });
    expect(await getAccountCollectionsAction("account-A")).toEqual({ ok: false, status: 403, error: "Account changed" });
    expect(await getAccountSavedCafesAction("account-A", "Favorites")).toEqual({ ok: false, status: 403, error: "Account changed" });
    expect(mocks.collections).not.toHaveBeenCalled();
  });

  it("returns 503 for a data failure while retaining a valid session", async () => {
    mocks.collections.mockRejectedValue(new Error("Database unavailable"));
    expect(await getAccountCollectionsAction("account-A")).toEqual({ ok: false, status: 503, error: "Database unavailable" });
  });

  it("reclassifies expiry during a read as 401", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "account-A" } }, error: null })
      .mockResolvedValueOnce({ data: { user: null }, error: null });
    mocks.saved.mockRejectedValue(new Error("Not authenticated"));
    expect(await getAccountSavedCafesAction("account-A", "Favorites")).toEqual({ ok: false, status: 401, error: "Not authenticated" });
  });

  it("does not return a successful read after the authenticated actor changes", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "account-A" } }, error: null })
      .mockResolvedValueOnce({ data: { user: { id: "account-B" } }, error: null });
    expect(await getAccountCollectionsAction("account-A")).toEqual({ ok: false, status: 403, error: "Account changed" });
  });

  it("allows only the development preview actor without Supabase", async () => {
    mocks.configured = false;
    expect(await getAccountCollectionsAction("development-preview")).toEqual({ ok: true, data: [{ name: "Favorites" }] });
    expect(await getAccountCollectionsAction("account-A")).toEqual({ ok: false, status: 403, error: "Account changed" });
  });
});
