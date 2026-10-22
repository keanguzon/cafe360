// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PendingFeedback } from "./pending-feedback";

let node: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
});

afterEach(() => {
  act(() => root.unmount());
  node.remove();
  vi.useRealTimers();
});

function render(props: Partial<ComponentProps<typeof PendingFeedback>> = {}) {
  act(() => root.render(<PendingFeedback pending operationKey="circle-a" onRefresh={() => {}} {...props} />));
}

it("shows pending feedback immediately, then recovery exactly at ten seconds", () => {
  const retry = vi.fn();
  const refresh = vi.fn();
  render({ onRetry: retry, onRefresh: refresh });
  expect(node.querySelector('[role="status"]')?.textContent).toContain("Loading");
  act(() => vi.advanceTimersByTime(9_999));
  expect(node.querySelector('[role="alert"]')).toBeNull();
  act(() => vi.advanceTimersByTime(1));
  expect(node.querySelector('[role="status"]')).toBeNull();
  expect(node.querySelector('[role="alert"]')?.textContent).toContain("Please try again");
  const buttons = Array.from(node.querySelectorAll("button"));
  act(() => buttons.find((button) => button.textContent === "Try again")!.click());
  act(() => buttons.find((button) => button.textContent === "Refresh page")!.click());
  expect(retry).toHaveBeenCalledOnce();
  expect(refresh).toHaveBeenCalledOnce();
});

it("keeps usable cached content free of loading and timeout UI", () => {
  render({ hasUsableData: true });
  act(() => vi.advanceTimersByTime(30_000));
  expect(node.innerHTML).toBe("");
  expect(vi.getTimerCount()).toBe(0);
});

it("clears timeout on completion and gives the next operation a fresh deadline", () => {
  render();
  act(() => vi.advanceTimersByTime(10_000));
  render({ pending: false });
  expect(node.innerHTML).toBe("");
  render();
  expect(node.querySelector('[role="status"]')).not.toBeNull();
  act(() => vi.advanceTimersByTime(9_999));
  expect(node.querySelector('[role="alert"]')).toBeNull();
});

it("does not carry a previous Circle timeout into another Circle", () => {
  render();
  act(() => vi.advanceTimersByTime(10_000));
  render({ operationKey: "circle-b" });
  expect(node.querySelector('[role="alert"]')).toBeNull();
  expect(node.querySelector('[role="status"]')).not.toBeNull();
  act(() => vi.advanceTimersByTime(10_000));
  expect(node.querySelector('[role="alert"]')).not.toBeNull();
});

it("does not offer a mutation retry until its caller has reconciled the outcome", () => {
  const retry = vi.fn();
  render({ kind: "mutation", onRetry: retry });
  act(() => vi.advanceTimersByTime(10_000));
  expect(node.textContent).toContain("not confirmed");
  expect(Array.from(node.querySelectorAll("button")).map((button) => button.textContent)).toEqual(["Refresh page"]);
  render({ kind: "mutation", onRetry: retry, retrySafe: true });
  expect(node.textContent).toContain("Try again");
  expect(retry).not.toHaveBeenCalled();
});

it("does not hide pending mutations just because an older value is cached", () => {
  render({ kind: "mutation", hasUsableData: true });
  expect(node.querySelector('[role="status"]')).not.toBeNull();
});

it("cleans up timers when removed", () => {
  render();
  act(() => root.render(null));
  expect(vi.getTimerCount()).toBe(0);
});

it("cancels an unfinished operation deadline on scope change", () => {
  render();
  act(() => vi.advanceTimersByTime(9_000));
  render({ operationKey: "circle-b" });
  act(() => vi.advanceTimersByTime(1_000));
  expect(node.querySelector('[role="alert"]')).toBeNull();
  expect(vi.getTimerCount()).toBe(1);
  act(() => vi.advanceTimersByTime(9_000));
  expect(node.querySelector('[role="alert"]')).not.toBeNull();
});
