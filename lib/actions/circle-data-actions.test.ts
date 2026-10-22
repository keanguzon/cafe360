import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCircleDataAction } from "./circle-data-actions";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), membership: vi.fn(), members: vi.fn(), visits: vi.fn(), saves: vi.fn(), summaries: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ hasSupabaseConfig: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: mocks.getUser },
  from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mocks.membership }) }) }) }),
}) }));
vi.mock("./group-actions", () => ({ getCircleMembersAction: mocks.members, getGroupSavedCafesAction: mocks.saves }));
vi.mock("./visit-actions", () => ({ getCircleVisitsAction: mocks.visits }));
vi.mock("./circle-cafe-actions", () => ({ getCircleCafeSummariesAction: mocks.summaries }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "account" } }, error: null });
  mocks.membership.mockResolvedValue({ data: { user_id: "account" }, error: null });
  [mocks.members, mocks.visits, mocks.saves, mocks.summaries].forEach((mock) => mock.mockResolvedValue([]));
});

describe("Circle snapshot authorization", () => {
  it("returns an explicit forbidden response after membership revocation", async () => {
    mocks.membership.mockResolvedValue({ data: null, error: null });
    expect(await getCircleDataAction("circle")).toEqual({ ok: false, status: 403, error: "Circle membership required" });
    expect(mocks.visits).not.toHaveBeenCalled();
  });
  it("returns an explicit expired-session result", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await getCircleDataAction("circle")).toMatchObject({ ok: false, status: 401 });
  });
  it("does not turn a membership query failure into an empty snapshot", async () => {
    mocks.membership.mockResolvedValue({ data: null, error: { message: "Membership query failed" } });
    expect(await getCircleDataAction("circle")).toEqual({ ok: false, status: 503, error: "Membership query failed" });
    expect(mocks.members).not.toHaveBeenCalled();
  });
  it("loads one scoped snapshot and keeps database errors distinct from empty", async () => {
    expect(await getCircleDataAction("circle")).toMatchObject({ ok: true, data: { members: [], visits: [], savedCafes: [], cafeSummaries: [] } });
    mocks.summaries.mockRejectedValue(new Error("Database unavailable"));
    expect(await getCircleDataAction("circle")).toMatchObject({ ok: false, status: 503 });
  });
  it("does not publish a partial snapshot when a member read fails", async () => {
    mocks.members.mockRejectedValue(new Error("Members unavailable"));
    expect(await getCircleDataAction("circle")).toEqual({ ok: false, status: 503, error: "Members unavailable" });
  });
});
