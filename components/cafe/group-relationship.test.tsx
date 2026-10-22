// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ context: vi.fn() }));

vi.mock("@/lib/context/circle-context", () => ({ useCircle: m.context }));

import { GroupRelationship } from "./group-relationship";

let root: Root;
let container: HTMLDivElement;
let context: Record<string, unknown>;

const interestedFriend = {
  id: "friend-b",
  username: "friendb",
  display_name: "Friend B",
  avatar_url: "https://images.example/friend-b.png",
};

const savingFriend = {
  id: "friend-a",
  username: "frienda",
  display_name: "Friend A",
  avatar_url: "https://images.example/friend-a.png",
};

const baseSummary = {
  internalId: "cafe-internal",
  providerId: "cafe-provider",
  name: "Coffee",
  coordinates: [1, 2] as [number, number],
  interestedMembers: [interestedFriend],
  visitCount: 0,
  photoCount: 0,
  rating: null,
  ratingCount: 0,
};

const savedByFriendA = {
  id: "save-a",
  group_id: "circle-a",
  cafe_id: "cafe-internal",
  saved_by: "friend-a",
  created_at: "2026-10-19T00:00:00.000Z",
};

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    activeCircle: { id: "circle-a" },
    circleMembers: [
      { userId: "friend-a", role: "member", displayName: "Friend A", avatarUrl: savingFriend.avatar_url },
      { userId: "friend-b", role: "member", displayName: "Friend B", avatarUrl: interestedFriend.avatar_url },
    ],
    circleVisits: [],
    circleSavedCafes: [],
    circleCafeSummaries: [baseSummary],
    isLoading: false,
    ...overrides,
  };
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  context = makeContext();
  m.context.mockImplementation(() => context);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function render(cafeId = "cafe-internal") {
  await act(async () => root.render(<GroupRelationship cafeId={cafeId} />));
}

it("counts actual shared saves, excluding interested members from the save count and avatars", async () => {
  context = makeContext({ circleSavedCafes: [savedByFriendA] });
  await render();

  expect(container.textContent).toContain("Saved by 1 member");
  expect(Array.from(container.querySelectorAll("[title]"), node => node.getAttribute("title"))).toEqual([
    "Friend A",
  ]);
});

it("does not show a saved count for interested members without a shared save", async () => {
  await render();

  expect(container.textContent).not.toContain("Saved by");
  expect(container.textContent).toContain("Be the first in your circle");
});

it.each([
  ["another Circle", { ...savedByFriendA, group_id: "circle-b" }],
  ["another café", { ...savedByFriendA, cafe_id: "another-cafe" }],
])("does not count saves from %s", async (_scope, savedCafe) => {
  context = makeContext({ circleSavedCafes: [savedCafe] });
  await render();

  expect(container.textContent).not.toContain("Saved by");
  expect(container.textContent).toContain("Be the first in your circle");
});
