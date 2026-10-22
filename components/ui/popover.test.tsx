// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

describe("Popover keyboard behavior", () => {
  it("closes on Escape and restores focus to its trigger", () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const node = document.createElement("div");
    document.body.append(node);
    const root = createRoot(node);
    act(() => root.render(<Popover><PopoverTrigger asChild><Button>Choose date</Button></PopoverTrigger><PopoverContent><button>Today</button></PopoverContent></Popover>));
    const trigger = node.querySelector<HTMLButtonElement>("button")!;
    act(() => trigger.click());
    const inside = [...node.querySelectorAll("button")].find((item) => item.textContent === "Today")!;
    inside.focus();
    act(() => inside.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(node.textContent).not.toContain("Today");
    expect(document.activeElement).toBe(trigger);
    act(() => root.unmount());
    node.remove();
  });
});
