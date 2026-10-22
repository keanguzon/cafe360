// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { CircleMemberInfo, GroupSavedCafe, Activity } from "@/lib/types/social";
import type { VisitWithDetails } from "@/lib/types/visit";
import { CircleOverview, CIRCLE_PREVIEW_LIMIT } from "./circle-overview";
import { ActivityItem } from "@/components/social/activity-item";

const mocks = vi.hoisted(() => ({ circle: {} as Record<string, unknown>, activity: {} as Record<string, unknown>, hook: vi.fn(), photo: vi.fn(), loadMore: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/context/circle-context", () => ({ useCircle: () => mocks.circle }));
vi.mock("@/lib/hooks/use-circle-activity", () => ({ useCircleActivity: (...args: unknown[]) => { mocks.hook(...args); return mocks.activity; } }));
vi.mock("@/components/visit/private-photo", () => ({ PrivatePhoto: (props: { path: string; groupId: string }) => { mocks.photo(props); return <span data-photo={props.path}/>; } }));
let node: HTMLDivElement;
let root: Root;
const openCafe = vi.fn();
const openMemory = vi.fn();
const rows = (section: string) => Array.from(node.querySelectorAll(`[data-testid="circle-${section}-preview"]`));
const render = (active = true) => act(() => root.render(<CircleOverview active={active} onOpenCafe={openCafe} onOpenMemory={openMemory}/>));

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  mocks.refresh.mockResolvedValue(undefined);
  const members: CircleMemberInfo[] = [
    ...Array.from({ length: 5 }, (_, i) => ({ userId: `member-${i}`, displayName: `Member ${i}`, avatarUrl: null, role: "member" as const })).reverse(),
    { userId: "self", displayName: "My name", avatarUrl: null, role: "owner" },
  ];
  const saves: GroupSavedCafe[] = Array.from({ length: 5 }, (_, i) => ({ id: `save-${i}`, group_id: "A", cafe_id: `cafe-${i}`, saved_by: "self", created_at: `2026-10-${10 + i}`, cafe_name: `Café ${i}` }));
  const visits: VisitWithDetails[] = Array.from({ length: 5 }, (_, i) => ({ id: `visit-${i}`, group_id: "A", cafe_id: `cafe-${i}`, created_by: "self", visited_at: `2026-10-${10 + i}`, created_at: "2026-10-19", updated_at: "2026-10-19", rating: null, notes: `Memory ${i}`, photos: Array.from({ length: 3 }, (_, p) => ({ id: `photo-${i}-${p}`, visit_id: `visit-${i}`, uploaded_by: "self", storage_path: `${i}/${p}`, caption: null, created_at: "2026-10-19" })) }));
  const activities: Activity[] = Array.from({ length: 5 }, (_, i) => ({ id: `event-${i}`, user_id: "self", group_id: "A", cafe_id: `cafe-${i}`, visit_id: null, type: "save", metadata: {}, created_at: `2026-10-${10 + i}`, cafe: { id: `cafe-${i}`, name: `Activity café ${i}` } }));
  mocks.circle = { accountId: "self", activeCircle: { id: "A", name: "Our Circle" }, userCircles: [{ id: "A" }], membershipsResolved: true, circleMembers: members, circleSavedCafes: saves, circleVisits: visits, isLoading: false, error: null, refreshCircleData: mocks.refresh };
  mocks.activity = { activities, initialLoading: false, error: null, loadMore: mocks.loadMore, refresh: mocks.refresh };
  node = document.createElement("div"); document.body.append(node); root = createRoot(node);
});
afterEach(() => { act(() => root.unmount()); node.remove(); vi.useRealTimers(); });

it("shows_uploaded_member_photos_and_falls_back_when_they_fail", () => {
  const members = mocks.circle.circleMembers as CircleMemberInfo[];
  members.find(member => member.userId === "self")!.avatarUrl = "https://example.com/self.jpg";
  members.find(member => member.userId === "member-0")!.avatarUrl = "https://example.com/member.jpg";
  render();
  const own = rows("member")[0];
  expect(own.querySelector("img")?.getAttribute("src")).toBe("https://example.com/self.jpg");
  expect(rows("member")[1].querySelector("img")?.getAttribute("src")).toBe("https://example.com/member.jpg");
  expect(rows("member")[2].querySelector("img")).toBeNull();
  act(() => own.querySelector("img")!.dispatchEvent(new Event("error")));
  expect(own.querySelector("img")).toBeNull();
  expect(own.textContent).toContain("M");
  members.find(member => member.userId === "self")!.avatarUrl = "https://example.com/new.jpg";
  render();
  expect(own.querySelector("img")?.getAttribute("src")).toBe("https://example.com/new.jpg");
});

it("shows_all_members_without_see_all_and_bounds_other_previews", () => {
  render();
  expect(CIRCLE_PREVIEW_LIMIT).toBe(2);
  expect(rows("member")).toHaveLength(6);
  expect(rows("member")[0].textContent).toContain("You");
  expect(node.querySelector('a[aria-label="See all members"]')).toBeNull();
  expect(rows("cafe")).toHaveLength(2); expect(rows("cafe")[0].textContent).toContain("Café 4");
  expect(rows("activity")).toHaveLength(2); expect(rows("activity")[0].textContent).toContain("Activity café 4");
  expect(rows("memory")).toHaveLength(2); expect(rows("memory")[0].textContent).toContain("Memory 4");
  expect(node.querySelector('a[href="/profile"]')).not.toBeNull();
  expect(node.querySelector('a[href="/profile/member-0?circle=A"]')).not.toBeNull();
  expect(node.textContent).not.toMatch(/Friend Connection|Send Friend Request/);
  for (const [name, href] of [["cafés", "/circles/A/cafes"], ["activity", "/circles/A/timeline?view=activity"], ["memories", "/circles/A/timeline?view=memories"]]) {
    expect(node.querySelector(`a[aria-label="See all ${name}"]`)?.getAttribute("href")).toBe(href);
  }
});
it("signs_only_two_preview_thumbnails", () => {
  render(); expect(node.querySelectorAll("[data-photo]")).toHaveLength(2);
  expect(mocks.photo.mock.calls.map(([props]) => props)).toEqual([{ path: "4/0", groupId: "A" }, { path: "3/0", groupId: "A" }]);
  render(false); expect(node.querySelectorAll("[data-photo]")).toHaveLength(0);
  expect(mocks.hook).toHaveBeenLastCalledWith("self", null);
});
it("hides_stale_scope_before_new_membership_resolves", () => {
  render(); mocks.circle.membershipsResolved = false; render();
  expect(node.textContent).not.toContain("My name"); expect(node.textContent).not.toContain("Memory 4");
  expect(node.querySelectorAll("a,button,[data-photo]")).toHaveLength(0);
  expect(mocks.hook).toHaveBeenLastCalledWith("self", null);
  mocks.circle.membershipsResolved = true; mocks.circle.userCircles = []; render();
  expect(node.textContent).not.toContain("Our Circle"); expect(rows("member")).toHaveLength(0);
});
it("does_not_fetch_more_activity_pages_for_preview", () => {
  render(); expect(mocks.loadMore).not.toHaveBeenCalled();
  expect(node.textContent).not.toContain("Load more");
});
it("keeps_activity_previews_short_without_full_feed_photos_or_notes", () => {
  const activities = mocks.activity.activities as Activity[];
  activities[4].type = "photo"; activities[4].metadata = { photoUrl: "https://example.com/private-photo.jpg" };
  activities[3].type = "visit"; activities[3].metadata = { notes: "A very long full-feed note", rating: 4 };
  render();
  expect(node.querySelector('img[src="https://example.com/private-photo.jpg"]')).toBeNull();
  expect(node.textContent).not.toContain("A very long full-feed note");
});
it("preserves_full_activity_content_outside_the_preview", () => {
  const activity = (mocks.activity.activities as Activity[])[0];
  act(() => root.render(<ActivityItem activity={{ ...activity, type: "visit", metadata: { notes: "Full feed note", rating: 4 } }}/>));
  expect(node.textContent).toContain("Full feed note"); expect(node.textContent).toContain("4.0");
  act(() => root.render(<ActivityItem activity={{ ...activity, type: "photo", metadata: { photoUrl: "https://example.com/full-feed.jpg" } }}/>));
  expect(node.querySelector('img[src="https://example.com/full-feed.jpg"]')).not.toBeNull();
});
it("uses_stable_ties_and_does_not_invent_a_self_card", () => {
  mocks.circle.circleMembers = (mocks.circle.circleMembers as CircleMemberInfo[]).filter(member => member.userId !== "self");
  (mocks.circle.circleMembers as CircleMemberInfo[]).forEach(member => { member.displayName = "Same name"; });
  (mocks.circle.circleSavedCafes as GroupSavedCafe[]).forEach(save => { save.created_at = "2026-10-19"; });
  render();
  expect(rows("member")).toHaveLength(5);
  expect(rows("member").map(row => row.getAttribute("href"))).toEqual(Array.from({length:5},(_,i)=>`/profile/member-${i}?circle=A`));
  expect(rows("cafe").map(row => row.textContent)).toEqual(["Café 0", "Café 1"]);
  expect(node.querySelector('a[href="/profile"]')).toBeNull();
});
it("rejects_mismatched_saved_visit_and_activity_groups", () => {
  (mocks.circle.circleSavedCafes as GroupSavedCafe[]).unshift({ id: "bad", group_id: "B", cafe_id: "secret", saved_by: "self", created_at: "2099-01-01", cafe_name: "Private B café" });
  (mocks.circle.circleVisits as VisitWithDetails[]).forEach(visit => { visit.group_id = "B"; });
  (mocks.activity.activities as Activity[]).forEach(activity => { activity.group_id = "B"; });
  render(); expect(node.textContent).not.toContain("Private B"); expect(rows("memory")).toHaveLength(0); expect(rows("activity")).toHaveLength(0); expect(mocks.photo).not.toHaveBeenCalled();
});
it("opens_only_selected_scope_rows_and_does_not_mutate_resource_order", () => {
  const saves = [...mocks.circle.circleSavedCafes as GroupSavedCafe[]];
  render(); act(() => (rows("cafe")[0] as HTMLButtonElement).click()); act(() => (rows("memory")[0].querySelector("button") as HTMLButtonElement).click());
  expect(openCafe).toHaveBeenCalledWith("cafe-4"); expect(openMemory).toHaveBeenCalledWith("visit-4");
  expect(mocks.circle.circleSavedCafes).toEqual(saves);
});
it("omits_a_missing_self_and_has_compact_local_empty_loading_and_error_states", async () => {
  mocks.circle.circleMembers = []; mocks.circle.circleSavedCafes = []; mocks.circle.circleVisits = []; mocks.activity.activities = [];
  render(); expect(rows("member")).toHaveLength(0); expect(node.querySelectorAll("a[aria-label^='See all']")).toHaveLength(0);
  expect(node.textContent).toContain("No memories yet");
  mocks.activity.initialLoading = true; render(); expect(node.textContent).toContain("Loading activity");
  mocks.activity.initialLoading = false; mocks.activity.error = "Activity unavailable"; render(); expect(node.textContent).toContain("Activity unavailable");
  await act(async () => node.querySelector<HTMLButtonElement>('[aria-label="Activity"] button')!.click()); expect(mocks.refresh).toHaveBeenCalledOnce();
});

it("times out cold sections, clears on late completion, and resets for a new Circle", () => {
  vi.useFakeTimers();
  mocks.activity.activities = []; mocks.activity.initialLoading = true;
  render(); act(() => vi.advanceTimersByTime(9_999));
  expect(node.querySelector('[aria-label="Activity"]')!.textContent).toContain("Loading activity");
  act(() => vi.advanceTimersByTime(1));
  expect(node.querySelector('[aria-label="Activity"]')!.textContent).toContain("taking too long");
  mocks.circle.activeCircle = { id: "B", name: "Other Circle" }; mocks.circle.userCircles = [{ id: "B" }];
  render(); expect(node.querySelector('[aria-label="Activity"]')!.textContent).toContain("Loading activity");
  mocks.activity.initialLoading = false; render(); act(() => vi.advanceTimersByTime(20_000));
  expect(node.querySelector('[aria-label="Activity"]')!.textContent).toContain("No activity yet");
  expect(node.textContent).not.toContain("taking too long");
});
