import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import MembersPage from "./[groupId]/members/page";
import CafesPage from "./[groupId]/cafes/page";
import TimelinePage from "./[groupId]/timeline/page";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), configured: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ hasSupabaseConfig: mocks.configured }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("next/navigation", () => ({ redirect: (href: string) => { throw new Error(`redirect:${href}`); } }));
vi.mock("@/components/circle/circle-full-list", () => ({ CircleFullList: () => null }));
vi.mock("@/components/sheet/circle-content", () => ({ StandaloneCircleContent: () => null }));
beforeEach(() => { vi.clearAllMocks(); mocks.configured.mockReturnValue(true); mocks.client.mockResolvedValue({ auth: { getUser: mocks.getUser } }); mocks.getUser.mockResolvedValue({ data: { user: { id: "account-a" } } }); });
it.each([["members", MembersPage], ["cafes", CafesPage]] as const)("awaits params and captures authenticated account for %s", async (view, page) => {
  const result = await page({ params: Promise.resolve({ groupId: "circle-b" }) });
  expect(result.props).toMatchObject({ circleId: "circle-b", accountId: "account-a", view });
});
it.each([["members", MembersPage], ["cafes", CafesPage]] as const)("requires a session for %s", async (view, page) => {
  mocks.getUser.mockResolvedValue({ data: { user: null } });
  await expect(page({ params: Promise.resolve({ groupId: "circle-b" }) })).rejects.toThrow(`redirect:/login?next=${encodeURIComponent(`/circles/circle-b/${view}`)}`);
});
it("captures timeline account and resolves both feed modes", async () => {
  for (const view of ["activity", "memories"]) {
    const result = await TimelinePage({ params: Promise.resolve({ groupId: "circle-b" }), searchParams: Promise.resolve({ view }) });
    expect(result.props).toMatchObject({ accountId: "account-a", circleId: "circle-b", view });
  }
});
it("requires a session for timeline", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null } });
  await expect(TimelinePage({ params: Promise.resolve({ groupId: "circle-b" }), searchParams: Promise.resolve({ view: "activity" }) })).rejects.toThrow("redirect:/login?next=%2Fcircles%2Fcircle-b%2Ftimeline%3Fview%3Dactivity");
});
it("uses_activity_for_absent_or_unsupported_timeline_view", async () => {
  for (const view of [undefined, "unknown", ["memories", "activity"]]) {
    const result = await TimelinePage({ params: Promise.resolve({ groupId: "circle-b" }), searchParams: Promise.resolve({ view }) });
    expect(result.props.view).toBe("activity");
  }
});
it("offers_map_guidance_without_constructing_unconfigured_supabase_client", async () => {
  mocks.configured.mockReturnValue(false);
  for (const page of [MembersPage, CafesPage, TimelinePage]) {
    const result = await page({ params: Promise.resolve({ groupId: "circle-b" }), searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(result);
    expect(html).toContain('href="/map"'); expect(html).toContain("Connect your account");
  }
  expect(mocks.client).not.toHaveBeenCalled();
});
