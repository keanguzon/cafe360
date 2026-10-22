// @vitest-environment jsdom
import { act, Suspense, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CircleSwitcherDialog } from "./circle-switcher-dialog";
import OnboardingPage from "@/app/(onboarding)/onboarding/page";
import CreateGroupPage from "@/app/(main)/circles/groups/new/page";
import { GroupDetailClient } from "@/app/(main)/circles/[groupId]/group-detail-client";
import InvitePage from "@/app/(entry)/invite/[code]/page";
import type { GroupWithMembers } from "@/lib/types/social";

const mocks = vi.hoisted(() => ({ create: vi.fn(), join: vi.fn(), leave: vi.fn(), remove: vi.fn(), profile: vi.fn(), push: vi.fn(), refresh: vi.fn(), error: vi.fn(), memberships: vi.fn(), evictMembership: vi.fn(), setActiveCircleId: vi.fn() }));
vi.mock("@/lib/actions/circle-data-actions", () => ({ getCircleDataAction: vi.fn().mockResolvedValue({ok:true,data:{members:[],visits:[],savedCafes:[],cafeSummaries:[]}}) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
vi.mock("@/lib/actions/group-actions", () => ({ createGroupAction: mocks.create, joinGroupViaInviteAction: mocks.join, leaveGroupAction: mocks.leave, deleteGroupAction: mocks.remove, getGroupByInviteCodeAction: async () => ({ name: "Coffee Crew" }), getUserGroupsAction: async () => [] }));
vi.mock("@/lib/actions/username-actions", () => ({ checkUsernameSetAction: async () => ({ hasUsername:true, displayName: "Coffee Friend", username: "coffee" }), setUsernameAction: mocks.profile }));
vi.mock("@/lib/context/circle-context", () => ({ useCircle: () => ({ userCircles: [{ id: "circle", name: "Coffee Crew", role: "owner", member_count: 1, invite_code: "ABCDEF" }, { id: "circle-2", name: "Other Crew", role: "member", member_count: 1, invite_code: "GHIJKL" }], accountId: "account", membershipsResolved: true, evictMembership: mocks.evictMembership, activeCircle: { id: "circle" }, refreshMemberships: mocks.memberships, setActiveCircleId: mocks.setActiveCircleId }) }));
vi.mock("./circle-invite-modal", () => ({ CircleInviteModal: () => null }));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: vi.fn() } }));

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  mocks.create.mockResolvedValue({ success: false, error: "Failed" });
  mocks.join.mockResolvedValue({ success: false, error: "Failed" });
  mocks.profile.mockResolvedValue({ success: true });
  mocks.leave.mockResolvedValue({ success: false, error: "Could not leave" });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => { act(() => root.unmount()); container.remove(); Reflect.deleteProperty(navigator, "onLine"); vi.restoreAllMocks(); });
async function render(node: ReactNode) { await act(async () => root.render(node)); }
async function offline() {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  await act(async () => { window.dispatchEvent(new Event("offline")); });
}
async function submit() { await act(async () => { container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }); }
async function input(selector: string, value: string) {
  await act(async () => {
    const element = container.querySelector<HTMLInputElement>(selector)!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function click(text: string) { await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent?.trim() === text)!.click(); }); }

it("retains a new group draft and blocks direct offline submit", async () => {
  await render(<CreateGroupPage />);
  await input("#group-name", "My draft");
  await offline(); await submit();
  expect(mocks.create).not.toHaveBeenCalled();
  expect(container.querySelector<HTMLInputElement>("#group-name")!.value).toBe("My draft");
  expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  expect(container.textContent).toContain("reconnect and retry");
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  await act(async () => { window.dispatchEvent(new Event("online")); });
  expect(mocks.create).not.toHaveBeenCalled();
  await submit();
  expect(mocks.create).toHaveBeenCalledWith({ name: "My draft", description: "" });
});

it("keeps onboarding at its profile step offline", async () => {
  await render(<OnboardingPage />); await offline(); await submit();
  expect(mocks.profile).not.toHaveBeenCalled();
  expect(container.querySelector<HTMLInputElement>('#displayName')?.value).toBe("Coffee Friend");
  expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
});

it.each(["create", "join"] as const)("preserves onboarding %s draft without queuing it", async (mode) => {
  await render(<OnboardingPage />); await submit();
  if (mode === "join") await click("Join Circle");
  const selector = mode === "create" ? "#group-name" : "#invite-code";
  await input(selector, mode === "create" ? "My circle" : "ABCDEF");
  await offline(); await submit();
  expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.join).not.toHaveBeenCalled();
  expect(container.querySelector<HTMLInputElement>(selector)!.value).toBe(mode === "create" ? "My circle" : "ABCDEF");
  expect(container.textContent).toContain("reconnect and retry");
});

it.each(["create", "join"] as const)("preserves switcher %s drafts offline", async (mode) => {
  await render(<CircleSwitcherDialog isOpen onClose={vi.fn()} />);
  await click(mode === "create" ? "Create Circle" : "Join Circle");
  await input("input", mode === "create" ? "My circle" : "ABCDEF");
  await offline(); await submit();
  expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.join).not.toHaveBeenCalled();
  expect(container.querySelector<HTMLInputElement>("input")!.value).toBe(mode === "create" ? "My circle" : "ABCDEF");
  expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  expect(container.textContent).toContain("reconnect and retry");
});

it("guards switcher destructive actions before an offline event can disable the button", async () => {
  await render(<CircleSwitcherDialog isOpen onClose={vi.fn()} />);
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  await act(async () => container.querySelector<HTMLButtonElement>('button[title="Delete Circle"]')!.click());
  expect(mocks.remove).not.toHaveBeenCalled(); expect(window.confirm).not.toHaveBeenCalled();
  expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("reconnect and retry"));
});

const group: GroupWithMembers = { id: "circle", name: "Coffee Crew", description: null, avatar_url: null, created_by: "owner", invite_code: "ABCDEF", created_at: "2026-01-01", updated_at: "2026-01-01", members: [], member_count: 1 };
it("stays on group details after a failed leave", async () => {
  await render(<GroupDetailClient group={group} saves={[]} />);
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Leave group"]')!.click());
  expect(mocks.push).not.toHaveBeenCalled();
  expect(mocks.error).toHaveBeenCalledWith("Could not leave");
  expect(mocks.evictMembership).not.toHaveBeenCalled();
  expect(container.textContent).toContain("Coffee Crew");
});

it("blocks the group detail leave action offline", async () => {
  await render(<GroupDetailClient group={group} saves={[]} />); await offline();
  expect(container.querySelector<HTMLButtonElement>('button[aria-label="Leave group"]')!.disabled).toBe(true);
  expect(mocks.leave).not.toHaveBeenCalled();
  expect(mocks.evictMembership).not.toHaveBeenCalled();
});

it("keeps an invitation open offline without joining", async () => {
  const params = Promise.resolve({ code: "ABCDEF" });
  await render(<Suspense fallback={null}><InvitePage params={params} /></Suspense>);
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  await act(async () => container.querySelector<HTMLButtonElement>("button")!.click());
  await offline();
  const button = container.querySelector<HTMLButtonElement>("button")!;
  expect(button.disabled).toBe(true); expect(mocks.join).not.toHaveBeenCalled();
  expect(container.textContent).toContain("reconnect and retry");
});

it.each(["profile", "create", "join"] as const)("retains onboarding %s fields when the request rejects", async (mode) => {
  await render(<OnboardingPage />);
  if (mode !== "profile") {
    await submit();
    if (mode === "join") await click("Join Circle");
    await input(mode === "create" ? "#group-name" : "#invite-code", mode === "create" ? "My draft" : "ABCDEF");
  }
  const action = mode === "profile" ? mocks.profile : mode === "create" ? mocks.create : mocks.join;
  action.mockRejectedValueOnce(new Error("Network unavailable"));
  await submit();
  expect(container.textContent).toContain("Please reconnect and retry");
  expect(mocks.push).not.toHaveBeenCalled();
  expect(container.querySelector<HTMLInputElement>(mode === "profile" ? "#displayName" : mode === "create" ? "#group-name" : "#invite-code")!.value).toBe(mode === "profile" ? "Coffee Friend" : mode === "create" ? "My draft" : "ABCDEF");
});

it("keeps the invite open when joining rejects", async () => {
  mocks.join.mockRejectedValueOnce(new Error("Network unavailable"));
  const params = Promise.resolve({ code: "ABCDEF" });
  await render(<Suspense fallback={null}><InvitePage params={params} /></Suspense>);
  await click("Join Circle");
  expect(container.textContent).toContain("Please reconnect and retry");
  expect(mocks.push).not.toHaveBeenCalled();
});

it("retains a group draft when the create request rejects", async () => {
  mocks.create.mockRejectedValueOnce(new Error("Network unavailable"));
  await render(<CreateGroupPage />); await input("#group-name", "My draft"); await submit();
  expect(container.querySelector<HTMLInputElement>("#group-name")!.value).toBe("My draft");
  expect(container.textContent).toContain("Could not create group");
  expect(mocks.push).not.toHaveBeenCalled();
});

it("refreshes Circle memberships on successful leave and activates the viewed Circle when opening the map", async () => {
  mocks.leave.mockResolvedValueOnce({ success: true });
  mocks.memberships.mockResolvedValueOnce([]);
  const otherGroup: GroupWithMembers = { ...group, id: "circle-2", name: "Other Crew" };
  await render(<GroupDetailClient group={otherGroup} saves={[]} />);

  const openMapLink = [...container.querySelectorAll("a")].find((link) => link.textContent?.includes("Open Map"));
  await act(async () => {
    openMapLink?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  expect(mocks.setActiveCircleId).toHaveBeenCalledWith("circle-2");

  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Leave group"]')!.click());
  expect(mocks.leave).toHaveBeenCalledWith("circle-2");
  expect(mocks.evictMembership).toHaveBeenCalledWith("circle-2");
  expect(mocks.evictMembership.mock.invocationCallOrder[0]).toBeLessThan(mocks.memberships.mock.invocationCallOrder[0]);
  expect(mocks.memberships).toHaveBeenCalledOnce();
  expect(mocks.push).toHaveBeenCalledWith("/circles");
});
