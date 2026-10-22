// @vitest-environment jsdom
import { act, createContext, useContext, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NavigationFeedbackProvider, NavigationLink, useFeedbackRouter } from "./navigation-feedback";

const navigation = vi.hoisted(() => ({ pending: false, push: vi.fn(), refresh: vi.fn(), retryPage: vi.fn(), reload: vi.fn() }));
vi.mock("@/lib/navigation/browser-recovery", () => ({ refreshPage: navigation.reload, retryPage: navigation.retryPage }));
const LinkContext = createContext(false);
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => <LinkContext.Provider value={navigation.pending}><a href={href}>{children}</a></LinkContext.Provider>,
  useLinkStatus: () => ({ pending: useContext(LinkContext) }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push, replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: navigation.refresh, prefetch: vi.fn() }),
}));

let node: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  navigation.pending = false;
  navigation.push.mockReset();
  navigation.retryPage.mockReset();
  navigation.reload.mockReset();
  node = document.createElement("div"); document.body.append(node); root = createRoot(node);
});
afterEach(() => { act(() => root.unmount()); node.remove(); vi.useRealTimers(); });

function render() {
  act(() => root.render(<NavigationFeedbackProvider><NavigationLink href="/profile">You</NavigationLink></NavigationFeedbackProvider>));
}

it("does not show feedback for a ready cached link", () => {
  render();
  act(() => vi.advanceTimersByTime(10_000));
  expect(node.querySelector('[data-navigation-feedback]')).toBeNull();
});

it("shows centered recovery at ten seconds and clears it on navigation completion", () => {
  navigation.pending = true; render();
  act(() => vi.advanceTimersByTime(150));
  expect(node.querySelector('[data-navigation-feedback] [role="status"]')).not.toBeNull();
  act(() => vi.advanceTimersByTime(9_850));
  expect(node.querySelector('[role="alert"]')?.textContent).toContain("Please try again");
  const retry = Array.from(node.querySelectorAll("button")).find(button => button.textContent === "Try again")!;
  act(() => retry.click());
  expect(navigation.retryPage).toHaveBeenCalledWith("/profile");
  const refresh = Array.from(node.querySelectorAll("button")).find(button => button.textContent === "Refresh page")!;
  act(() => refresh.click());
  expect(navigation.reload).toHaveBeenCalledOnce();
  navigation.pending = false; render();
  expect(node.querySelector('[data-navigation-feedback]')).toBeNull();
});

it("does not flash an overlay for a fast completed transition", () => {
  navigation.pending = true; render();
  act(() => vi.advanceTimersByTime(100));
  navigation.pending = false; render();
  act(() => vi.advanceTimersByTime(10_000));
  expect(node.querySelector('[data-navigation-feedback]')).toBeNull();
});

function ImperativeNavigation() {
  const router = useFeedbackRouter();
  return <button onClick={() => router.push("/settings")}>Settings</button>;
}

it("keeps imperative router navigation working without a provider", () => {
  act(() => root.render(<ImperativeNavigation />));
  act(() => node.querySelector("button")!.click());
  expect(navigation.push).toHaveBeenCalledWith("/settings");
});
