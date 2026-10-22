// @vitest-environment jsdom
import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import InvitePage from "./page";

const mocks = vi.hoisted(() => ({ preview: vi.fn(), groups: vi.fn(), join: vi.fn(), push: vi.fn(), setup:vi.fn() }));
vi.mock("@/lib/actions/username-actions",()=>({checkUsernameSetAction:mocks.setup}));
vi.mock("@/lib/actions/group-actions", () => ({ getGroupByInviteCodeAction: mocks.preview, getUserGroupsAction: mocks.groups, joinGroupViaInviteAction: mocks.join }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
let node: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks(); localStorage.clear();
  mocks.preview.mockResolvedValue({ name: "Our Circle", member_count: 2 });
  mocks.groups.mockResolvedValue([]);
  mocks.setup.mockResolvedValue({hasUsername:true});
  node = document.createElement("div"); document.body.append(node); root = createRoot(node);
});
afterEach(() => { act(() => root.unmount()); node.remove(); });
async function render(code = "ABC123") {
  const params = Promise.resolve({ code });
  await act(async () => { root.render(<Suspense><InvitePage params={params}/></Suspense>); await params; });
}
it('requires new-account setup before displaying an actionable invitation',async()=>{
 mocks.setup.mockResolvedValue({hasUsername:false});
 await render('abc123');
 expect(mocks.push).toHaveBeenCalledWith('/onboarding?invite=ABC123');
 expect(mocks.join).not.toHaveBeenCalled();
 expect([...node.querySelectorAll('button')].some(b=>b.textContent==='Join Circle'&&!b.disabled)).toBe(false);
});
it('retries a failed profile lookup without sending an existing user to setup',async()=>{
 mocks.setup.mockResolvedValueOnce({hasUsername:false,error:'Profile unavailable'});
 await render();
 expect(mocks.push).not.toHaveBeenCalled();expect(mocks.join).not.toHaveBeenCalled();
 expect(node.textContent).toContain('Try again');
 mocks.setup.mockResolvedValue({hasUsername:true});
 await act(async()=>[...node.querySelectorAll('button')].find(b=>b.textContent==='Try again')!.click());
 expect(node.textContent).toContain('Join Circle');expect(mocks.push).not.toHaveBeenCalled();
});
it("opens_an_existing_membership_without_joining_again", async () => {
  mocks.groups.mockResolvedValue([{ id: "already-member", invite_code: "ABC123" }]);
  await render("abc123");
  expect(node.textContent).toContain("You're already a member");
  expect(node.querySelector('a[href="/circles/already-member"]')?.textContent).toContain("Open Circle");
  expect([...node.querySelectorAll("button")].some(button => button.textContent === "Join Circle")).toBe(false);
  expect(mocks.join).not.toHaveBeenCalled();
});
it("joins_a_new_circle_and_opens_that_circle_without_legacy_selection_storage", async () => {
  mocks.join.mockResolvedValue({ success: true, groupId: "new-circle" });
  await render();
  await act(async () => node.querySelector("button")!.click());
  expect(mocks.join).toHaveBeenCalledWith("ABC123");
  expect(mocks.push).toHaveBeenCalledWith("/circles/new-circle");
  expect(localStorage.getItem("cafe360_active_circle_id")).toBeNull();
});
it("shows_retry_instead_of_a_join_when_membership_check_fails", async () => {
  mocks.groups.mockRejectedValue(new Error("Unavailable"));
  await render();
  expect(node.querySelector('[role="alert"]')?.textContent).toContain("Could not load");
  expect(node.textContent).toContain("Try again");
  expect(mocks.join).not.toHaveBeenCalled();
});
it("offers_retry_when_preview_returns_null", async () => {
  mocks.preview.mockResolvedValue(null);
  await render();
  expect(node.querySelector('[role="alert"]')?.textContent).toContain("Could not load");
  expect(node.textContent).toContain("Try again");
});
it("opens_a_verified_membership_even_if_the_preview_is_unavailable", async () => {
  mocks.preview.mockResolvedValue(null);
  mocks.groups.mockResolvedValue([{ id: "already-member", invite_code: "ABC123", name: "Our Circle" }]);
  await render();
  expect(node.querySelector('a[href="/circles/already-member"]')).not.toBeNull();
});
