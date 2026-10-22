// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SettingsPage from "./page";
const mocks = vi.hoisted(() => ({ push: vi.fn(), hasCircles: false, membershipsResolved: true }));
vi.mock("@/lib/context/circle-context",()=>({useCircle:()=>({accountId:"A", membershipsResolved:mocks.membershipsResolved, userCircles:mocks.hasCircles?[{id:"circle-a"}]:[]})}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "light", setTheme: vi.fn() }) }));
vi.mock("@/lib/supabase/config", () => ({ hasSupabaseConfig: () => false }));
vi.mock("@/components/auth/sign-out-modal", () => ({ SignOutModal: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div role="dialog">Confirm sign out</div> : null }));
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  mocks.hasCircles = false; mocks.membershipsResolved = true; mocks.push.mockClear();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div"); document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
it("opens the shared sign-out confirmation instead of signing out directly", () => {
  act(() => root.render(<SettingsPage />));
  const signOut = Array.from(container.querySelectorAll("button")).find(b => b.textContent?.trim() === "Sign Out")!;
  act(() => signOut.click());
  expect(container.querySelector('[role="dialog"]')?.textContent).toBe("Confirm sign out");
  expect(container.querySelector("main")).toBeNull();
});


it("returns an account with no Circles to onboarding", () => {
  mocks.hasCircles = false;
  act(() => root.render(<SettingsPage />));
  const back = Array.from(container.querySelectorAll("button")).find(b => b.textContent?.trim() === "Go back")!;
  act(() => back.click());
  expect(mocks.push).toHaveBeenLastCalledWith("/onboarding");
  expect(container.querySelector('a[href="/map"]')).toBeNull();
  expect(container.querySelector('a[href="/onboarding"]')).not.toBeNull();
});
it("returns an existing member to the map", () => {
  mocks.hasCircles = true;
  act(() => root.render(<SettingsPage />));
  const back = Array.from(container.querySelectorAll("button")).find(b => b.textContent?.trim() === "Go back")!;
  act(() => back.click());
  expect(mocks.push).toHaveBeenLastCalledWith("/map");
  expect(container.querySelector('a[href="/map"]')).not.toBeNull();
});

it("keeps the map return destination while memberships are still loading", () => {
  mocks.membershipsResolved = false;
  mocks.hasCircles = false;
  act(() => root.render(<SettingsPage />));
  const back = Array.from(container.querySelectorAll("button")).find(b => b.textContent?.trim() === "Go back")!;
  act(() => back.click());
  expect(mocks.push).toHaveBeenLastCalledWith("/map");
  expect(container.querySelector('a[href="/map"]')).not.toBeNull();
  expect(container.querySelector('a[href="/onboarding"]')).toBeNull();
});
