// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VisitWithDetails } from "@/lib/types/visit";
import { VisitTimelineFetcher } from "./visit-timeline-fetcher";

const { useCircleMock } = vi.hoisted(() => ({
  useCircleMock: vi.fn(),
}));

vi.mock("@/lib/context/circle-context", () => ({
  useCircle: useCircleMock,
}));

vi.mock("./visit-timeline", () => ({
  VisitTimeline: ({ visits }: { visits: VisitWithDetails[] }) => (
    <div data-testid="visit-timeline">
      {visits.map((v) => (
        <span key={v.id} data-testid="visit-item">{v.notes}</span>
      ))}
    </div>
  ),
}));

describe("VisitTimelineFetcher", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
  });

  const makeVisit = (id: string, notes: string): VisitWithDetails => ({
    id,
    cafe_id: "internal-uuid-1",
    group_id: "circle-1",
    created_by: "user-1",
    visited_at: "2026-10-16",
    rating: 5,
    notes,
    created_at: "2026-10-16T08:00:00.000Z",
    updated_at: "2026-10-16T08:00:00.000Z",
    creator: {
      id: "user-1",
      username: "ana",
      display_name: "Ana",
      avatar_url: null,
    },
    participants: [],
    photos: [],
  });

  it("reads Circle-keyed visits matching providerId or internalId and updates immediately when Circle data invalidates", () => {
    useCircleMock.mockReturnValue({
      activeCircle: { id: "circle-1", name: "Weekend Crew" },
      circleVisits: [makeVisit("v-1", "First pour-over")],
      circleCafeSummaries: [
        {
          internalId: "internal-uuid-1",
          providerId: "mapbox-place-1",
          name: "Yardstick",
          coordinates: [121.0, 14.5],
          interestedMembers: [],
          visitCount: 1,
          photoCount: 0,
          rating: 5,
          ratingCount: 1,
        },
      ],
      isLoading: false,
    });

    act(() => {
      root?.render(<VisitTimelineFetcher cafeId="mapbox-place-1" groupId="circle-1" />);
    });

    expect(container.textContent).toContain("First pour-over");

    useCircleMock.mockReturnValue({
      activeCircle: { id: "circle-1", name: "Weekend Crew" },
      circleVisits: [
        makeVisit("v-2", "Newly logged Spanish latte"),
        makeVisit("v-1", "First pour-over"),
      ],
      circleCafeSummaries: [
        {
          internalId: "internal-uuid-1",
          providerId: "mapbox-place-1",
          name: "Yardstick",
          coordinates: [121.0, 14.5],
          interestedMembers: [],
          visitCount: 2,
          photoCount: 0,
          rating: 4.5,
          ratingCount: 2,
        },
      ],
      isLoading: false,
    });

    act(() => {
      root?.render(<VisitTimelineFetcher cafeId="mapbox-place-1" groupId="circle-1" />);
    });

    expect(container.textContent).toContain("Newly logged Spanish latte");
    expect(container.textContent).toContain("First pour-over");
  });
});
