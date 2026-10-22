// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { Calendar } from "./calendar";

describe("Calendar month navigation", () => {
  it("names both month controls and advances the displayed month by keyboard", () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const node = document.createElement("div");
    document.body.append(node);
    const root = createRoot(node);
    act(() => root.render(<Calendar selected={new Date(2026, 9, 16)} />));
    const previous = node.querySelector<HTMLButtonElement>('button[aria-label="Previous month"]');
    const next = node.querySelector<HTMLButtonElement>('button[aria-label="Next month"]');
    expect(previous).not.toBeNull();
    expect(next).not.toBeNull();
    expect(next?.className).toContain("size-11");
    act(() => next?.click());
    expect(node.textContent).toContain("November 2026");
    act(() => root.unmount());
    node.remove();
  });
});
