// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { ActivityItem } from "./activity-item";
import type { Activity } from "@/lib/types/social";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

it.each([
  { compact: false, cafeName: "Blue Bottle" },
  { compact: true, cafeName: "Blue Bottle" },
  { compact: false, cafeName: null },
  { compact: true, cafeName: null },
])("renders interest activity in compact=$compact with cafe=$cafeName", async ({ compact, cafeName }) => {
  const activity: Activity = {
    id: "activity-1",
    user_id: "user-1",
    type: "interest",
    cafe_id: cafeName ? "cafe-1" : null,
    group_id: null,
    visit_id: null,
    metadata: {},
    created_at: new Date().toISOString(),
    cafe: cafeName ? { id: "cafe-1", name: cafeName } : null,
  };

  await act(async () => root.render(<ActivityItem activity={activity} compact={compact} />));

  const content = container.textContent?.replace(/\s+/g, " ") ?? "";
  expect(content).toContain(`Someone is interested in ${cafeName || "a café"}`);
  expect(content).not.toContain("did an activity");
  expect(container.querySelector('[role="img"]')?.getAttribute("aria-label")).toBe("User");
});
