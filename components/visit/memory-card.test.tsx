// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as visitDate from "@/lib/utils/visit-date";
import type { VisitWithDetails } from "@/lib/types/visit";
import { MemoryCard } from "./memory-card";

vi.mock("./private-photo", () => ({
  PrivatePhoto: ({ path }: { path: string }) => <div data-testid="private-photo">{path}</div>,
}));

describe("MemoryCard", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  const baseVisit: VisitWithDetails = {
    id: "visit-1",
    cafe_id: "cafe-1",
    group_id: "group-1",
    created_by: "user-1",
    visited_at: "2026-10-16",
    rating: 0,
    notes: "Solid espresso",
    created_at: "2026-10-16T08:00:00.000Z",
    updated_at: "2026-10-16T08:00:00.000Z",
    creator: {
      id: "user-1",
      username: "juan",
      display_name: "Juan",
      avatar_url: null,
    },
    participants: [],
    photos: [{ id: "photo-1", visit_id: "visit-1", storage_path: "user-1/photo.jpg", caption: null, uploaded_by: "user-1", created_at: "2026-10-16T08:00:00.000Z" }],
  };

  it("parses visited_at as a local calendar date via parseLocalDate and renders 0 ratings", () => {
    const parseSpy = vi.spyOn(visitDate, "parseLocalDate");

    act(() => {
      root?.render(<MemoryCard visit={baseVisit} />);
    });

    expect(parseSpy).toHaveBeenCalledWith("2026-10-16");
    expect(container.textContent).toContain("October 16, 2026");
    expect(container.textContent).toContain("0");
    expect(container.querySelector('[data-testid="private-photo"]')?.textContent).toBe("user-1/photo.jpg");
  });
});
