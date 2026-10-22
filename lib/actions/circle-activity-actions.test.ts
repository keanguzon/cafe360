import { beforeEach, expect, it, vi } from "vitest";
import { getCircleActivityPageAction } from "./circle-activity-actions";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), member: vi.fn(), from: vi.fn(), limit: vi.fn(), eq: vi.fn(), order: vi.fn(), or: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ hasSupabaseConfig: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.auth }, from: mocks.from }) }));
const group = "20000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
  mocks.member.mockResolvedValue({ data: { user_id: "owner" }, error: null });
  const membership = { select: () => membership, eq: () => membership, maybeSingle: mocks.member };
  const activities = { select: () => activities, eq: mocks.eq, order: mocks.order, or: mocks.or, limit: mocks.limit };
  mocks.eq.mockReturnValue(activities); mocks.order.mockReturnValue(activities); mocks.or.mockReturnValue(activities);
  mocks.from.mockImplementation((table) => table === "group_members" ? membership : activities);
  mocks.limit.mockResolvedValue({ data: [], error: null });
});
it("returns 401 without querying activity when signed out", async () => {
  mocks.auth.mockResolvedValue({ data: { user: null }, error: null });
  expect(await getCircleActivityPageAction(group)).toMatchObject({ ok: false, status: 401 });
  expect(mocks.limit).not.toHaveBeenCalled();
});
it("distinguishes revocation from transient membership failures", async () => {
  mocks.member.mockResolvedValue({ data: null, error: null });
  expect(await getCircleActivityPageAction(group)).toMatchObject({ ok: false, status: 403 });
  mocks.member.mockResolvedValue({ data: null, error: { message: "offline" } });
  expect(await getCircleActivityPageAction(group)).toMatchObject({ ok: false, status: 503 });
  expect(mocks.limit).not.toHaveBeenCalled();
});
it("scopes stable pagination by Circle and validates cursors before querying", async () => {
  await getCircleActivityPageAction(group, { id: group, createdAt: "2026-10-16T00:00:00.000Z" });
  expect(mocks.eq).toHaveBeenCalledWith("group_id", group);
  expect(mocks.order).toHaveBeenCalledWith("id", { ascending: false });
  expect(mocks.or).toHaveBeenCalledWith(expect.stringContaining(`id.lt.${group}`));
  mocks.or.mockClear();
  expect(await getCircleActivityPageAction(group, { id: "anything),group_id.neq.x", createdAt: "bad" })).toMatchObject({ ok: false, status: 400 });
  expect(mocks.or).not.toHaveBeenCalled();
});
it("reports database failure rather than a successful empty feed", async () => {
  mocks.limit.mockResolvedValue({ data: null, error: { message: "offline" } });
  expect(await getCircleActivityPageAction(group)).toMatchObject({ ok: false, status: 503 });
});
it("returns a continuation cursor without mixing the twenty-first record into the page", async () => {
  const rows = Array.from({ length: 21 }, (_, i) => ({ id: `id-${i}`, created_at: "2026-10-16T00:00:00Z", group_id: group }));
  mocks.limit.mockResolvedValue({ data: rows, error: null });
  const result = await getCircleActivityPageAction(group);
  expect(result).toMatchObject({ ok: true, data: { nextCursor: { id: "id-19", createdAt: rows[19].created_at } } });
  if (result.ok) expect(result.data.items).toHaveLength(20);
});
