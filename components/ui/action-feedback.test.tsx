// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ActionFeedback } from "./action-feedback";

let node: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  node = document.createElement("div");
  root = createRoot(node);
});
afterEach(() => { act(() => root.unmount()); vi.useRealTimers(); });

it("reports an unresolved mutation without retrying or declaring failure, then clears on late completion", () => {
  const refresh = vi.fn();
  act(() => root.render(<ActionFeedback pending operationKey="account:circle:cafe:save" label="Saving café…" onRefresh={refresh} />));
  expect(node.textContent).toContain("Saving café");
  act(() => vi.advanceTimersByTime(10_000));
  expect(node.textContent).toContain("not confirmed");
  expect(node.querySelectorAll("button")).toHaveLength(1);
  expect(refresh).not.toHaveBeenCalled();
  act(() => node.querySelector("button")!.click());
  expect(refresh).toHaveBeenCalledOnce();
  act(() => root.render(<ActionFeedback pending={false} operationKey="account:circle:cafe:save" />));
  expect(node.textContent).toBe("");
});

it("does not start feedback for ordinary disabled controls or carry timeout into a new resource", () => {
  act(() => root.render(<ActionFeedback pending={false} operationKey="a" />));
  expect(vi.getTimerCount()).toBe(0);
  act(() => root.render(<ActionFeedback pending operationKey="a" />));
  act(() => vi.advanceTimersByTime(10_000));
  act(() => root.render(<ActionFeedback pending operationKey="b" />));
  expect(node.querySelector('[role="alert"]')).toBeNull();
  expect(node.querySelector('[role="status"]')).not.toBeNull();
});
