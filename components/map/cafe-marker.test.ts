// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { createCafeMarkerElement } from "./cafe-marker";

describe("café map marker", () => {
  it("can be reached and activated with Enter or Space", () => {
    const open = vi.fn();
    const marker = createCafeMarkerElement({ id: "cafe-1", name: "Cafe North", address: "Main St", coordinates: [120, 14] }, false, open);
    document.body.append(marker);
    expect(marker.tabIndex).toBe(0);
    expect(marker.getAttribute("aria-label")).toContain("Cafe North");
    marker.focus();
    marker.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    marker.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(open).toHaveBeenCalledTimes(2);
    marker.remove();
  });
});
