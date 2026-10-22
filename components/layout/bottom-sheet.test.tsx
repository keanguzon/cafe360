// @vitest-environment jsdom

import { StrictMode, act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BottomSheet } from "./bottom-sheet";

function NestedSheets({ closeOuter, closeInner }: { closeOuter: () => void; closeInner: () => void }) {
  const [outerOpen, setOuterOpen] = useState(true);
  const [innerOpen, setInnerOpen] = useState(true);
  return <>
    <button id="background">Background</button>
    <BottomSheet isOpen={outerOpen} onClose={() => { setOuterOpen(false); closeOuter(); }} title="Outer">
      <button id="outer-content">Outer content</button>
      <BottomSheet isOpen={innerOpen} onClose={() => { setInnerOpen(false); closeInner(); }} title="Inner">
        <button id="inner-content">Inner content</button>
      </BottomSheet>
    </BottomSheet>
  </>;
}

describe("BottomSheet focus", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("fits the visible keyboard viewport and keeps the half sheet content above its bottom edge", async () => {
    const viewport = Object.assign(new EventTarget(), { height: 400, offsetTop: 40 });
    vi.stubGlobal("visualViewport", viewport);
    await act(async () => root.render(<BottomSheet isOpen onClose={() => {}} title="Visit"><input aria-label="Notes" /></BottomSheet>));
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    const wrapper = dialog.parentElement!;
    expect(wrapper.style.bottom).toBe(`${Math.max(0, window.innerHeight - 440)}px`);
    expect(dialog.style.height).toBe("368px");
    expect((dialog.firstElementChild as HTMLElement).style.height).toBe("220px");

    viewport.height = 600;
    viewport.offsetTop = 0;
    await act(async () => viewport.dispatchEvent(new Event("resize")));
    expect(dialog.style.height).toBe("552px");
    expect((dialog.firstElementChild as HTMLElement).style.height).toBe("330px");
    expect(wrapper.style.bottom).toBe(`${Math.max(0, window.innerHeight - 600)}px`);
  });

  it("keeps the nested sheet on top when both open in the first render", async () => {
    const closeOuter = vi.fn();
    const closeInner = vi.fn();
    await act(async () => root.render(<StrictMode><NestedSheets closeOuter={closeOuter} closeInner={closeInner} /></StrictMode>));
    const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
    expect(dialogs).toHaveLength(2);
    const inner = Array.from(dialogs).find((dialog) => dialog.textContent?.includes("Inner"))!;
    const outer = Array.from(dialogs).find((dialog) => dialog.textContent?.includes("Outer"))!;
    expect(inner).toBeDefined();
    expect(Number((inner.parentElement as HTMLElement).style.zIndex))
      .toBeGreaterThan(Number((outer.parentElement as HTMLElement).style.zIndex));
    expect((document.activeElement as HTMLElement).closest('[role="dialog"]')).toBe(inner);
    const background = document.querySelector<HTMLElement>("#background")!;
    background.focus();
    expect((document.activeElement as HTMLElement).closest('[role="dialog"]')).toBe(inner);
    await act(async () => document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(closeInner).toHaveBeenCalledOnce();
    expect(closeOuter).not.toHaveBeenCalled();
  });
});
