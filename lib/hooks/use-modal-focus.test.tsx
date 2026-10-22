// @vitest-environment jsdom

import { StrictMode, act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModalFocusScope, useModalFocus } from "./use-modal-focus";

function ModalHarness({ onOuterClose, onInnerClose }: { onOuterClose: () => void; onInnerClose: () => void }) {
  const [outerOpen, setOuterOpen] = useState(false);
  const [innerOpen, setInnerOpen] = useState(false);
  const { ref: outerRef, scopeId } = useModalFocus<HTMLDivElement>(outerOpen, () => { setOuterOpen(false); onOuterClose(); });
  const { ref: innerRef } = useModalFocus<HTMLDivElement>(innerOpen, () => { setInnerOpen(false); onInnerClose(); });
  return (
    <>
      <button id="launch" onClick={() => setOuterOpen(true)}>Launch</button>
      {outerOpen && <div ref={outerRef} role="dialog" aria-modal="true" tabIndex={-1}>
        <button id="outer-first">Outer first</button>
        <button id="open-inner" onClick={() => setInnerOpen(true)}>Open inner</button>
        <button id="outer-last">Outer last</button>
      </div>}
      <ModalFocusScope id={scopeId}>{innerOpen && <div ref={innerRef} role="dialog" aria-modal="true" tabIndex={-1}>
        <button id="inner-first">Inner first</button>
        <button id="inner-last">Inner last</button>
      </div>}</ModalFocusScope>
    </>
  );
}

function Child({ close }: { close: () => void }) {
  const { ref } = useModalFocus<HTMLDivElement>(true, close);
  return <div ref={ref} role="dialog" tabIndex={-1}><button id="initial-child">Child</button></div>;
}

function InitiallyNested({ closeParent, closeChild }: { closeParent: () => void; closeChild: () => void }) {
  const { ref, scopeId } = useModalFocus<HTMLDivElement>(true, closeParent);
  return <div ref={ref} role="dialog" tabIndex={-1}>
    <button id="initial-parent">Parent</button>
    <ModalFocusScope id={scopeId}><Child close={closeChild} /></ModalFocusScope>
  </div>;
}

function RefusingModal({ onClose }: { onClose: () => void }) {
  const { ref } = useModalFocus<HTMLDivElement>(true, onClose);
  return <div ref={ref} role="dialog" tabIndex={-1}><button>Pending save</button></div>;
}

function historyToken(): string | null {
  const token = window.history.state?.__cafe360ModalHistory;
  return typeof token === "string" ? token : null;
}

async function waitForCondition(condition: () => boolean) {
  const deadline = Date.now() + 2000;
  while (!condition() && Date.now() < deadline) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
  }
  expect(condition()).toBe(true);
}

describe("useModalFocus", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    act(() => root.unmount());
    container.remove();
    await waitForCondition(() => historyToken() === null);
  });

  it("keeps only the latest dialog keyboard-active and restores each opener in StrictMode", () => {
    const onOuterClose = vi.fn();
    const onInnerClose = vi.fn();
    act(() => root.render(<StrictMode><ModalHarness onOuterClose={onOuterClose} onInnerClose={onInnerClose} /></StrictMode>));
    const launch = document.querySelector<HTMLButtonElement>("#launch")!;
    launch.focus();
    act(() => launch.click());
    expect(document.activeElement?.id).toBe("outer-first");
    const openInner = document.querySelector<HTMLButtonElement>("#open-inner")!;
    openInner.focus();
    act(() => openInner.click());
    expect(document.activeElement?.id).toBe("inner-first");

    const innerLast = document.querySelector<HTMLButtonElement>("#inner-last")!;
    innerLast.focus();
    act(() => innerLast.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true })));
    expect(document.activeElement?.id).toBe("inner-first");
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    expect(onInnerClose).toHaveBeenCalledOnce();
    expect(onOuterClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(openInner);

    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    expect(onOuterClose).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(launch);
  });

  it("keeps the child on top when both dialogs open in the same StrictMode render", () => {
    const closeParent = vi.fn();
    const closeChild = vi.fn();
    act(() => root.render(<StrictMode><InitiallyNested closeParent={closeParent} closeChild={closeChild} /></StrictMode>));
    expect(document.activeElement?.id).toBe("initial-child");
    act(() => document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(closeChild).toHaveBeenCalledOnce();
    expect(closeParent).not.toHaveBeenCalled();
  });

  it("uses same-URL Back to close the top dialog before route navigation", async () => {
    const closeOuter = vi.fn();
    const closeInner = vi.fn();
    const startingUrl = window.location.href;
    act(() => root.render(<StrictMode><InitiallyNested closeParent={closeOuter} closeChild={closeInner} /></StrictMode>));
    await act(async () => { await Promise.resolve(); });
    expect(window.history.state?.__cafe360ModalHistory).toEqual(expect.any(String));
    expect(window.location.href).toBe(startingUrl);
    window.history.back();
    await waitForCondition(() => closeInner.mock.calls.length === 1);
    expect(closeInner).toHaveBeenCalledOnce();
    expect(closeOuter).not.toHaveBeenCalled();
    expect(window.location.href).toBe(startingUrl);
  });

  it("removes a programmatically closed modal history entry", async () => {
    const closeOuter = vi.fn();
    const closeInner = vi.fn();
    act(() => root.render(<StrictMode><ModalHarness onOuterClose={closeOuter} onInnerClose={closeInner} /></StrictMode>));
    const launch = document.querySelector<HTMLButtonElement>("#launch")!;
    act(() => launch.click());
    await act(async () => { await Promise.resolve(); });
    const modalState = window.history.state;
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    await waitForCondition(() => historyToken() === null);
    expect(closeOuter).toHaveBeenCalledOnce();
    expect(window.history.state).not.toEqual(modalState);
  });

  it("re-arms Back when a pending dialog refuses to close", async () => {
    const onClose = vi.fn();
    act(() => root.render(<RefusingModal onClose={onClose} />));
    await act(async () => { await Promise.resolve(); });
    const firstToken = historyToken();
    expect(firstToken).toEqual(expect.any(String));
    window.history.back();
    await waitForCondition(() => onClose.mock.calls.length === 1 &&
      historyToken() !== null && historyToken() !== firstToken);
    expect(onClose).toHaveBeenCalledOnce();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    const secondToken = historyToken();
    expect(secondToken).toEqual(expect.any(String));
    window.history.back();
    await waitForCondition(() => onClose.mock.calls.length === 2 &&
      historyToken() !== null && historyToken() !== secondToken);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("does not close a modal for unrelated route history", async () => {
    const onClose = vi.fn();
    act(() => root.render(<RefusingModal onClose={onClose} />));
    await act(async () => { await Promise.resolve(); });
    const originalUrl = window.location.href;
    window.history.pushState({ route: true }, "", "#unrelated-route");
    window.history.back();
    await waitForCondition(() => window.location.href === originalUrl);
    expect(onClose).not.toHaveBeenCalled();
    expect(window.location.href).toBe(originalUrl);
  });

  it("arms a reopened dialog after the previous close finishes its Back traversal", async () => {
    const closeOuter = vi.fn();
    act(() => root.render(<ModalHarness onOuterClose={closeOuter} onInnerClose={vi.fn()} />));
    const launch = document.querySelector<HTMLButtonElement>("#launch")!;
    act(() => launch.click());
    await act(async () => { await Promise.resolve(); });
    const oldToken = window.history.state?.__cafe360ModalHistory;
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    act(() => launch.click());
    await waitForCondition(() => historyToken() !== null && historyToken() !== oldToken);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(window.history.state?.__cafe360ModalHistory).not.toBe(oldToken);
    window.history.back();
    await waitForCondition(() => closeOuter.mock.calls.length === 2);
    expect(closeOuter).toHaveBeenCalledTimes(2);
  });
});
