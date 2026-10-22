// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CircleFullList } from "./circle-full-list";
import { CirclePageHeader } from "./circle-page-header";

const mocks = vi.hoisted(() => ({ context: {} as Record<string, unknown>, select: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/context/circle-context", () => ({ useCircle: () => mocks.context }));
let node: HTMLDivElement;
let root: Root;
const render = (circleId = "A", view: "members" | "cafes" = "members", accountId = "self") => act(() => root.render(<CircleFullList circleId={circleId} view={view} accountId={accountId}/>));
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks(); mocks.refresh.mockResolvedValue(undefined);
  mocks.context = {
    accountId: "self", membershipsResolved: true, activeCircle: { id: "A", name: "Morning coffee" },
    userCircles: [{ id: "A", name: "Morning coffee" }, { id: "B", name: "Weekend coffee" }],
    circleMembers: [...Array.from({ length: 5 }, (_, i) => ({ userId: `member-${i}`, displayName: `Member ${i}`, role: "member", avatarUrl: null })), { userId: "self", displayName: "My name", role: "owner", avatarUrl: null }],
    circleSavedCafes: Array.from({ length: 5 }, (_, i) => ({ id: `save-${i}`, group_id: "A", cafe_id: `internal-${i}`, cafe_name: `Café ${i}`, created_at: `2026-10-${10 + i}` })),
    isLoading: false, error: null, refreshCircleData: mocks.refresh, setActiveCircleId: mocks.select,
  };
  node = document.createElement("div"); document.body.append(node); root = createRoot(node);
});
afterEach(() => { act(() => root.unmount()); node.remove(); });

it("renders_the_uploaded_avatar_in_member_lists", () => {
  (mocks.context.circleMembers as {userId:string;avatarUrl:string|null}[]).find(member => member.userId === "self")!.avatarUrl = "https://example.com/me.jpg";
  render();
  expect(node.querySelector('li img')?.getAttribute('src')).toBe("https://example.com/me.jpg");
});

it("shows_all_rows_and_circle_name", () => {
  render();
  expect(node.textContent).toContain("Morning coffee");
  expect(node.querySelector("h1")?.textContent).toBe("Members");
  expect(node.querySelectorAll("li")).toHaveLength(6);
  expect(node.querySelector("li")?.textContent).toContain("You");
  expect(node.querySelector('a[href="/map"]')?.textContent).toContain("Return to map");
  expect(node.querySelector('a[href="/map"]')?.className).toContain("text-sm");
  expect(node.querySelector('a[href="/map"]')?.className).toContain("font-medium");
  render("A", "cafes");
  expect(node.querySelectorAll("li")).toHaveLength(5);
  expect(node.querySelector('a[href="/cafes/internal-4?circle=A"]')).not.toBeNull();
});
it("requires_explicit_selection_for_other_circle", () => {
  mocks.context.circleSavedCafes = [{ id: "secret", group_id: "B", cafe_id: "private", cafe_name: "Private B café", created_at: "2026-10-19" }];
  render("B", "cafes");
  expect(node.textContent).toContain("Weekend coffee");
  expect(node.textContent).toContain("Select this Circle");
  expect(node.textContent).not.toContain("Private B café");
  expect(mocks.select).not.toHaveBeenCalled();
  act(() => node.querySelector("button")!.click());
  expect(mocks.select).toHaveBeenCalledWith("B");
  expect(node.textContent).not.toContain("Private B café");
  mocks.context.activeCircle = { id: "B", name: "Weekend coffee" };
  render("B", "cafes");
  expect(node.textContent).toContain("Private B café");
});
it("member_links_preserve_circle_without_friend_request", () => {
  render();
  expect(node.querySelector('a[href="/profile"]')).not.toBeNull();
  expect(node.querySelector('a[href="/profile/member-0?circle=A"]')).not.toBeNull();
  expect(node.textContent).not.toMatch(/Friend Connection|Send Friend Request/);
});
it("hides_unknown_revoked_unresolved_and_other_account_content", () => {
  render("unknown"); expect(node.textContent).toContain("unavailable"); expect(node.querySelector("li,button")).toBeNull();
  mocks.context.userCircles = []; render(); expect(node.textContent).not.toContain("Morning coffee"); expect(node.querySelector("li")).toBeNull();
  mocks.context.userCircles = [{ id: "A", name: "Morning coffee" }]; mocks.context.membershipsResolved = false; render();
  expect(node.textContent).toContain("Loading Circle"); expect(node.textContent).not.toContain("Morning coffee"); expect(node.querySelector("li")).toBeNull();
  mocks.context.membershipsResolved = true; mocks.context.accountId = "other"; render();
  expect(node.querySelector("li,button")).toBeNull(); expect(node.textContent).not.toContain("Morning coffee");
});
it("filters_foreign_cafes_and_shows_loading_error_retry_and_empty_states", async () => {
  mocks.context.circleSavedCafes = [{ id: "foreign", group_id: "B", cafe_id: "private", cafe_name: "Private B café" }];
  render("A", "cafes"); expect(node.textContent).not.toContain("Private B café"); expect(node.textContent).toContain("No Circle cafés yet");
  mocks.context.isLoading = true; render("A", "cafes"); expect(node.textContent).toContain("Loading cafés");
  mocks.context.isLoading = false; mocks.context.error = "Could not load Circle"; render("A", "cafes");
  expect(node.querySelector('[role="alert"]')?.textContent).toContain("Could not load Circle");
  await act(async () => node.querySelector("button")!.click()); expect(mocks.refresh).toHaveBeenCalledOnce();
});
it("header_names_only_current_authorized_membership", () => {
  act(() => root.render(<CirclePageHeader circleId="A" title="Memories"/>));
  expect(node.textContent).toContain("Morning coffee"); expect(node.querySelector("h1")?.textContent).toBe("Memories");
  mocks.context.userCircles = [];
  act(() => root.render(<CirclePageHeader circleId="A" title="Memories"/>));
  expect(node.textContent).not.toContain("Morning coffee"); expect(node.querySelector("button")).toBeNull();
});
