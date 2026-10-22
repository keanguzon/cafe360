// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { SheetNavigationProvider, useSheetNavigation, SHEET_HISTORY_KEY } from "./sheet-navigation";
const next = vi.hoisted(() => ({ pathname: "/map", query: "", push: vi.fn(), back: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => next.pathname, useSearchParams: () => new URLSearchParams(next.query), useRouter: () => ({ push: next.push, back: next.back }) }));
let root: Root; let container: HTMLDivElement; let latest: ReturnType<typeof useSheetNavigation>;
function Probe() { const value = useSheetNavigation(); useEffect(() => { latest = value; }, [value]); return null; }
function render(accountId = "A") { act(() => root.render(<SheetNavigationProvider accountId={accountId}><Probe /></SheetNavigationProvider>)); }
function settle(href: string, state?: unknown) { const url = new URL(href, location.origin); next.pathname = url.pathname; next.query = url.searchParams.toString(); if (state) history.replaceState(state, "", href); render(); }
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.resetAllMocks(); next.pathname = "/map"; next.query = ""; history.replaceState({ __NA: true, tree: "next-tree" }, "", "/map"); container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
it("adds one entry per content navigation and preserves Next state", async () => {
  render(); const initial = history.length;
  next.push.mockImplementation((href: string) => history.pushState({ ...history.state, tree: "next-new" }, "", href));
  await act(async () => { await latest.open({ kind: "saved", root: "saved" }); }); settle("/profile/collections");
  expect(history.length).toBe(initial + 1); expect(history.state.tree).toBe("next-new"); expect(history.state.__NA).toBe(true);
  const saved = history.state;
  await act(async () => { await latest.open({ kind: "cafe", root: "nearby", entityId: "cafe", circleId: "group" }); }); settle("/cafes/cafe?circle=group");
  expect(latest.activeRoot).toBe("saved"); expect(history.state[SHEET_HISTORY_KEY].originRoot).toBe("saved");
  await act(async () => { await latest.back(); }); expect(next.back).toHaveBeenCalledOnce();
  settle("/profile/collections", saved); expect(latest.activeRoot).toBe("saved");
});
it("restores You origin on browser back and forward", async () => {
  render(); next.push.mockImplementation((href: string) => history.pushState({ ...history.state }, "", href));
  await act(async () => { await latest.open({ kind: "you", root: "you" }); }); settle("/profile"); const you = history.state;
  await act(async () => { await latest.open({ kind: "settings", root: "nearby" }); }); settle("/settings"); const settings = history.state;
  settle("/profile", you); settle("/settings", settings); expect(latest.activeRoot).toBe("you");
});
it("fresh nested entry uses Nearby and safe Back, resetting on account change", async () => {
  next.pathname = "/settings"; history.replaceState({ __NA: true }, "", "/settings"); render(); expect(latest.activeRoot).toBe("nearby");
  await act(async () => { await latest.back(); }); expect(next.push).toHaveBeenCalledWith("/map", { scroll: false }); expect(next.back).not.toHaveBeenCalled();
  render("B"); expect(history.state[SHEET_HISTORY_KEY].index).toBe(0);
});
it("guards dirty adapter navigation and unregisters without changing history", async () => {
  render(); const initial = history.length; const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const unregister = latest.registerDirty("form", true);
  await act(async () => { expect(await latest.open({ kind: "saved", root: "saved" })).toBe(false); }); expect(next.push).not.toHaveBeenCalled();
  unregister(); await act(async () => { expect(await latest.open({ kind: "saved", root: "saved" })).toBe(true); }); expect(history.length).toBe(initial); confirm.mockRestore();
});
it("cancels ordinary same-origin page links before they can discard a dirty visit",()=>{
 render();latest.registerDirty('visit',true);
 const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);
 const link=document.createElement('a');link.href='/profile/collections';document.body.append(link);
 const depart=vi.fn((event:MouseEvent)=>event.preventDefault());link.addEventListener('click',depart);
 act(()=>link.click());expect(depart).not.toHaveBeenCalled();expect(confirm).toHaveBeenCalledOnce();
 link.remove();confirm.mockRestore();
});
it("does not prompt twice for an accepted link handled by the navigation adapter",async()=>{
 render();latest.registerDirty('visit',true);const confirm=vi.spyOn(window,'confirm').mockReturnValue(true);
 const link=document.createElement('a');link.href='/profile';document.body.append(link);
 link.addEventListener('click',event=>{event.preventDefault();void latest.open({kind:'you',root:'you'});});
 await act(async()=>link.click());expect(confirm).toHaveBeenCalledOnce();expect(next.push).toHaveBeenCalledWith('/profile',{scroll:false});
 link.remove();confirm.mockRestore();
});

it("releases a pending navigation if router push throws", async () => {
  render(); next.push.mockImplementationOnce(() => { throw new Error("navigation failed"); });
  await expect(latest.open({ kind: "saved", root: "saved" })).rejects.toThrow("navigation failed");
  await expect(latest.open({ kind: "you", root: "you" })).resolves.toBe(true);
});
it("confirms dirty safe Back only once", async () => {
  next.pathname = "/settings"; history.replaceState({}, "", "/settings"); render();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true); latest.registerDirty("form", true);
  await latest.back(); expect(confirm).toHaveBeenCalledOnce(); confirm.mockRestore();
});

it("cancels an owned browser Back without growing history or exposing the target", async () => {
  render(); const initialEntry = history.state;
  next.push.mockImplementation((href: string) => history.pushState({ ...history.state }, "", href));
  await latest.open({kind:"settings",root:"nearby"}); settle("/settings");
  latest.registerDirty("edit", true);
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const go = vi.spyOn(history, "go").mockImplementation(() => {});
  const length = history.length;
  history.replaceState(initialEntry,"","/map");
  window.dispatchEvent(new PopStateEvent("popstate",{state:initialEntry}));
  expect(confirm).toHaveBeenCalledOnce(); expect(go).toHaveBeenCalledWith(1);
  expect(latest.activeRoute?.kind).toBe("settings"); expect(history.length).toBe(length);
  go.mockRestore(); confirm.mockRestore();
});
it("requests platform confirmation for a dirty document departure and removes it on cleanup", () => {
  render(); const cleanup = latest.registerDirty("edit",true);
  const event = new Event("beforeunload", {cancelable:true}); window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true); cleanup();
  const cleanEvent = new Event("beforeunload",{cancelable:true}); window.dispatchEvent(cleanEvent);
  expect(cleanEvent.defaultPrevented).toBe(false);
});
it("recovers a router navigation that never settles", async () => {
  vi.useFakeTimers(); render(); await latest.open({kind:"saved",root:"saved"});
  act(() => vi.advanceTimersByTime(10000));
  expect(await latest.open({kind:"you",root:"you"})).toBe(true); vi.useRealTimers();
});
it("restores a cancelled real history traversal and then allows Forward after discard", async () => {
  render(); next.push.mockImplementation((href: string) => history.pushState({...history.state},"",href));
  await latest.open({kind:"settings",root:"nearby"});settle("/settings");
  const settings=history.state; const cleanup=latest.registerDirty("edit",true);
  const confirm=vi.spyOn(window,"confirm").mockReturnValue(false); const length=history.length;
  await new Promise<void>(resolve=>{
    const restored=(event:PopStateEvent)=>{if(event.state?.[SHEET_HISTORY_KEY]?.index===settings[SHEET_HISTORY_KEY].index){window.removeEventListener("popstate",restored,true);resolve();}};
    // Register ahead of the provider's stopping listener by observing URL after both traversals.
    window.addEventListener("popstate",restored,true);
    history.back();
    const check=setInterval(()=>{if(confirm.mock.calls.length && location.pathname==="/settings"){clearInterval(check);window.removeEventListener("popstate",restored,true);resolve();}},10);
  });
  expect(location.pathname).toBe("/settings");expect(history.length).toBe(length);expect(confirm).toHaveBeenCalledOnce();
  cleanup();confirm.mockReturnValue(true);
  await new Promise<void>(resolve=>{window.addEventListener("popstate",()=>resolve(),{once:true});history.back();});
  await new Promise<void>(resolve=>{window.addEventListener("popstate",()=>resolve(),{once:true});history.forward();});
  expect(location.pathname).toBe("/settings");confirm.mockRestore();
});

it("serializes dirty pop confirmations while a cancelled traversal restores", async () => {
 render();const predecessor=history.state;
 next.push.mockImplementation((href:string)=>history.pushState({...history.state},"",href));
 await latest.open({kind:"settings",root:"nearby"});settle("/settings");const current=history.state;
 latest.registerDirty("edit",true);const confirm=vi.spyOn(window,"confirm").mockReturnValue(false);
 const go=vi.spyOn(history,"go").mockImplementation(()=>{});
 window.dispatchEvent(new PopStateEvent("popstate",{state:predecessor}));
 window.dispatchEvent(new PopStateEvent("popstate",{state:predecessor}));
 expect(confirm).toHaveBeenCalledOnce();
 window.dispatchEvent(new PopStateEvent("popstate",{state:current}));
 window.dispatchEvent(new PopStateEvent("popstate",{state:predecessor}));
 expect(confirm).toHaveBeenCalledTimes(2);go.mockRestore();confirm.mockRestore();
});
