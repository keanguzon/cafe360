// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  navigation: {
    discover: { query: "coffee", filters: ["openNow", "specialty"], scrollTop: 0 },
    update: vi.fn(),
  },
  cafes: [
    { id: "one", name: "First Café", rating: 4.8, priceLevel: 1, distanceMeters: 2000 },
    { id: "two", name: "Second Café", rating: 4.1, priceLevel: 2, distanceMeters: 5000 },
  ],
}));

vi.mock("@/lib/context/navigation-state", () => ({
  useNavigationState: () => state.navigation,
}));
vi.mock("@/lib/context/circle-context", () => ({
  useCircle: () => ({ accountId: "account", circleCafeSummaries: [] }),
}));
vi.mock("@/lib/hooks/use-cafes", () => ({
  useCafes: (options: { initialQuery: string }) => ({
    cafes: state.cafes,
    query: options.initialQuery,
    setQuery: vi.fn(),
    isLoading: false,
    selectedCafe: null,
    setSelectedCafe: vi.fn(),
    fetchCafes: vi.fn(),
    coords: [120.9, 14.4],
    error: null,
  }),
}));
vi.mock("@/lib/hooks/use-local-location", () => ({
  useLocalLocation: () => ({
    coordinates: null,
    requestLocation: vi.fn(),
    status: "idle",
    error: null,
  }),
}));
vi.mock("@/components/cafe/search-bar", () => ({ SearchBar: () => null }));
vi.mock("@/components/cafe/cafe-card", () => ({
  CafeCard: ({ cafe }: { cafe: { name: string } }) => <div>{cafe.name}</div>,
}));
vi.mock("@/components/cafe/cafe-detail-sheet", () => ({ CafeDetailSheet: () => null }));

import DiscoverPage from "./discover-page";

let root: Root;
let node: HTMLDivElement;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  state.navigation.discover = {
    query: "coffee",
    filters: ["openNow", "specialty"],
    scrollTop: 0,
  };
  state.navigation.update.mockClear();
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
});

afterEach(() => {
  act(() => root.unmount());
  node.remove();
});

it("ignores legacy filters in chips, results, and retained navigation state", () => {
  act(() => root.render(<DiscoverPage />));

  const filterRow = node.querySelector(".overflow-x-auto");
  expect(Array.from(filterRow!.querySelectorAll("button"), (button) => button.textContent)).toEqual([
    "Top Rated (4.5+)",
    "Near Me (< 3km)",
    "Budget-Friendly ($)",
  ]);
  expect(node.textContent).toContain("2 cafés found");
  expect(node.textContent).toContain("First Café");
  expect(node.textContent).toContain("Second Café");

  act(() => root.unmount());
  expect(state.navigation.update).toHaveBeenCalledWith({
    discover: expect.objectContaining({ filters: [] }),
  });
});
