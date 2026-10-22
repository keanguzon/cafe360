"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "@/components/navigation/router";
import { parseSheetRoute, sheetHref, sheetParentHref, sheetRoot, type RootView, type SheetRoute } from "@/lib/navigation/sheet-routes";

export const SHEET_HISTORY_KEY = "cafe360.sheet";
type Entry = { nonce: string; index: number; originRoot: RootView };
type SheetNavigation = {
  confirmLeave(): boolean;
  open(route: SheetRoute): Promise<boolean>;
  back(): Promise<boolean>;
  registerDirty(id: string, dirty: boolean): () => void;
  activeRoute: SheetRoute | null;
  activeRoot: RootView;
};
const Context = createContext<SheetNavigation | null>(null);
function createSession(initialRoot: RootView) {
  let root = initialRoot;
  const listeners = new Set<() => void>();
  return {
    nonce: crypto.randomUUID(), index: 0, entries: new Set<number>(),
    pending: null as { href: string; root: RootView; index: number } | null,
    dirty: new Map<string, symbol>(),
    approvedHref: null as string | null,
    approvalTimer: null as ReturnType<typeof setTimeout> | null,
    approveHref(href:string|null) {
      if(this.approvalTimer)clearTimeout(this.approvalTimer);
      this.approvedHref=href;
      this.approvalTimer=href?setTimeout(()=>{this.approvedHref=null;this.approvalTimer=null;},0):null;
    },
    consumeApproval(href:string) {
      if(this.approvedHref!==href)return false;
      this.approveHref(null);return true;
    },
    restoring: null as number | null,
    allowedPop: false,
    popTimer: null as ReturnType<typeof setTimeout> | null,
    pendingTimer: null as ReturnType<typeof setTimeout> | null,
    getSnapshot: () => root,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setPending(value: { href: string; root: RootView; index: number } | null) {
      if (this.pendingTimer) clearTimeout(this.pendingTimer);
      this.pending = value;
      this.pendingTimer = value ? setTimeout(() => { this.pending = null; this.pendingTimer = null; }, 10000) : null;
    },
    setIndex(value: number) { this.index = value; },
    allowPop() {
      this.allowedPop = true;
      if (this.popTimer) clearTimeout(this.popTimer);
      this.popTimer = setTimeout(() => { this.allowedPop = false; }, 10000);
    },
    clearPop() { this.allowedPop = false; if (this.popTimer) clearTimeout(this.popTimer); },
    setRoot(value: RootView) { if (value !== root) { root = value; listeners.forEach((listener) => listener()); } },
  };
}
function ownedEntry(state: unknown, nonce: string): Entry | null {
  const entry = (state as Record<string, Entry> | null)?.[SHEET_HISTORY_KEY];
  return entry?.nonce === nonce && Number.isSafeInteger(entry.index) && entry.index >= 0 && ["nearby", "saved", "you"].includes(entry.originRoot) ? entry : null;
}
function AccountSheetNavigation({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const query = search.toString();
  const activeRoute = useMemo(() => parseSheetRoute(pathname, new URLSearchParams(query)), [pathname, query]);
  const [session] = useState(() => createSession(activeRoute ? sheetRoot(activeRoute) ?? "nearby" : "nearby"));
  const retainedRoot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const activeRoot = activeRoute ? sheetRoot(activeRoute) ?? retainedRoot : retainedRoot;

  useEffect(() => {
    function pop(event: PopStateEvent) {
      const target = ownedEntry(event.state, session.nonce);
      if (session.restoring !== null) {
        event.stopImmediatePropagation();
        if (target?.index === session.restoring) session.restoring = null;
        else if (target) history.go(session.restoring - target.index);
        return;
      }
      session.setPending(null);
      if (session.allowedPop) { session.allowedPop = false; if (session.popTimer) clearTimeout(session.popTimer); if (target) session.setIndex(target.index); return; }
      if (!target || target.index === session.index) return;
      if (session.dirty.size === 0 || window.confirm("Discard your unsaved changes?")) { session.setIndex(target.index); return; }
      // Capture runs before Next's bubble listener: a cancelled target never renders.
      event.stopImmediatePropagation();
      session.restoring = session.index;
      history.go(session.index - target.index);
    }
    function unload(event: BeforeUnloadEvent) {
      if (!session.dirty.size) return;
      event.preventDefault();
      event.returnValue = "";
    }
    function failed() { session.setPending(null); }
    function linkDeparture(event:MouseEvent) {
      if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||!session.dirty.size)return;
      const anchor=event.target instanceof Element?event.target.closest('a'):null;
      if(!anchor||anchor.hasAttribute('download')||(anchor.target&&anchor.target!=='_self'))return;
      const url=new URL(anchor.href,location.href);
      if(url.origin!==location.origin||url.pathname+url.search===location.pathname+location.search)return;
      if(!window.confirm('Discard your unsaved changes?')){event.preventDefault();event.stopImmediatePropagation();return;}
      const href=url.pathname+url.search;
      session.approveHref(href);
    }
    document.addEventListener('click',linkDeparture,true);
    window.addEventListener("popstate", pop, true);
    window.addEventListener("beforeunload", unload);
    window.addEventListener("error", failed);
    window.addEventListener("unhandledrejection", failed);
    return () => {
      window.removeEventListener("popstate", pop, true);
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("error", failed);
      window.removeEventListener("unhandledrejection", failed);
      session.setPending(null);
      if (session.popTimer) clearTimeout(session.popTimer);
      session.dirty.clear();
      session.approveHref(null);
      document.removeEventListener('click',linkDeparture,true);
    };
  }, [session]);

  useEffect(() => {
    if (!activeRoute) return;
    const href = `${pathname}${query ? `?${query}` : ""}`;
    const pending = session.pending;
    const owned = ownedEntry(history.state, session.nonce);
    let entry: Entry;
    if (pending?.href === href) {
      entry = { nonce: session.nonce, index: pending.index, originRoot: pending.root };
      session.setPending(null);
      for (const index of session.entries) if (index >= entry.index) session.entries.delete(index);
    } else if (owned) {
      entry = owned;
    } else {
      entry = { nonce: session.nonce, index: 0, originRoot: sheetRoot(activeRoute) ?? "nearby" };
      session.entries.clear();
    }
    session.setIndex(entry.index);
    session.entries.add(entry.index);
    session.setRoot(sheetRoot(activeRoute) ?? entry.originRoot);
    history.replaceState({ ...history.state, [SHEET_HISTORY_KEY]: entry }, "");
  }, [pathname, query, session, activeRoute]);

  function canLeave(href?:string) {
    if(href&&session.consumeApproval(href))return true;
    return session.dirty.size === 0 || window.confirm("Discard your unsaved changes?");
  }
  async function navigate(route: SheetRoute) {
    const href = sheetHref(route);
    if (href === `${pathname}${query ? `?${query}` : ""}`) return true;
    if (session.pending || session.restoring !== null) return false;
    session.setPending({ href, root: sheetRoot(route) ?? activeRoot, index: session.index + 1 });
    try { router.push(href, { scroll: false }); } catch (error) { session.setPending(null); throw error; }
    return true;
  }
  async function open(route: SheetRoute) {
    if (!canLeave(sheetHref(route))) return false;
    return navigate(route);
  }
  async function back() {
    if (!canLeave() || session.pending || session.restoring !== null) return false;
    if (session.entries.has(session.index - 1)) {
      session.allowPop();
      try { router.back(); } catch (error) { session.clearPop(); throw error; }
    }
    else if (activeRoute) {
      const href = sheetParentHref(activeRoute);
      const url = new URL(href, window.location.origin);
      const parent = parseSheetRoute(url.pathname, url.searchParams);
      if (parent) return navigate(parent);
    }
    return true;
  }
  const registerDirty = useCallback((id: string, dirty: boolean) => {
    const token = Symbol(id);
    if (dirty) session.dirty.set(id, token); else session.dirty.delete(id);
    return () => { if (session.dirty.get(id) === token) session.dirty.delete(id); };
  }, [session]);
  return <Context.Provider value={{ open, back, confirmLeave:canLeave, registerDirty, activeRoute, activeRoot }}>{children}</Context.Provider>;
}
export function SheetNavigationProvider({ accountId, children }: { accountId: string; children: ReactNode }) {
  return <AccountSheetNavigation key={accountId}>{children}</AccountSheetNavigation>;
}
export function useSheetNavigation() {
  const context = useContext(Context);
  if (!context) throw new Error("SheetNavigationProvider is required");
  return context;
}


