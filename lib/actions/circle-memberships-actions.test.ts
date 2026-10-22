import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CircleSummary } from "@/lib/types/social";
import { getAccountCirclesAction } from "./circle-memberships-actions";

const mocks = vi.hoisted(() => ({
  configured: true,
  getUser: vi.fn(),
  list: vi.fn(),
}));

vi.mock("@/lib/supabase/config", () => ({ hasSupabaseConfig: () => mocks.configured }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("./group-actions", () => ({ getUserCirclesSummaryAction: mocks.list }));

const circle = { id: "circle-1", name: "Friends" } as CircleSummary;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.configured = true;
  mocks.getUser.mockResolvedValue({ data: { user: { id: "account-1" } }, error: null });
  mocks.list.mockResolvedValue([circle]);
});

describe("getAccountCirclesAction", () => {
  it("returns a serializable list for the authenticated account", async () => {
    expect(await getAccountCirclesAction("account-1")).toEqual({ ok: true, data: [circle] });
    expect(mocks.list).toHaveBeenCalledOnce();
  });

  it("returns a verified empty membership as success", async () => {
    mocks.list.mockResolvedValue([]);
    expect(await getAccountCirclesAction("account-1")).toEqual({ ok: true, data: [] });
  });

  it("returns 401 and skips the Circle query when authentication expires", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await getAccountCirclesAction("account-1")).toEqual({ ok: false, status: 401, error: "Not authenticated" });
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("returns 403 and skips the Circle query for a different actor", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "account-2" } }, error: null });
    expect(await getAccountCirclesAction("account-1")).toEqual({ ok: false, status: 403, error: "Account changed" });
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("reports a membership query failure as 503, not an empty Circle", async () => {
    mocks.list.mockRejectedValue(new Error("Database unavailable"));
    expect(await getAccountCirclesAction("account-1")).toEqual({ ok: false, status: 503, error: "Database unavailable" });
  });

  it("reports 401 if the session expires while the membership list is loading", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "account-1" } }, error: null })
      .mockResolvedValueOnce({ data: { user: null }, error: null });
    mocks.list.mockRejectedValue(new Error("Not authenticated"));
    expect(await getAccountCirclesAction("account-1")).toEqual({ ok: false, status: 401, error: "Not authenticated" });
  });

  it("permits the development preview actor only without Supabase configuration", async () => {
    mocks.configured = false;
    expect(await getAccountCirclesAction("development-preview")).toEqual({ ok: true, data: [circle] });
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(await getAccountCirclesAction("account-1")).toEqual({ ok: false, status: 403, error: "Account changed" });
  });
});
