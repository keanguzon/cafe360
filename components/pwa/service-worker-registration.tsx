"use client";

import { useEffect, useSyncExternalStore } from "react";
import { OFFLINE_MUTATION_MESSAGE, useOnlineStatus } from "@/lib/hooks/use-online-status";

let updateReady = false;
const updateListeners = new Set<() => void>();
function subscribeUpdates(listener: () => void) {
  updateListeners.add(listener);
  return () => { updateListeners.delete(listener); };
}

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let active = true;
    const report = (error: unknown) => console.warn("Cafe360 offline support is unavailable", error);
    void navigator.serviceWorker.register("/sw.js").then((registration) => {
      if (!active) return;
      let stopWatchingWorker = () => {};
      const checkWaiting = () => {
        if (active) {
          updateReady = Boolean(registration.waiting && navigator.serviceWorker.controller);
          updateListeners.forEach((listener) => listener());
        }
      };
      const watchInstalling = () => {
        stopWatchingWorker();
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", checkWaiting);
        stopWatchingWorker = () => worker.removeEventListener("statechange", checkWaiting);
      };
      checkWaiting();
      watchInstalling();
      registration.addEventListener("updatefound", watchInstalling);
      const refreshWorker = () => {
        if (document.visibilityState === "visible") void registration.update().catch(report);
      };
      document.addEventListener("visibilitychange", refreshWorker);
      cleanup = () => {
        document.removeEventListener("visibilitychange", refreshWorker);
        registration.removeEventListener("updatefound", watchInstalling);
        stopWatchingWorker();
      };
    }).catch(report);
    let cleanup = () => {};
    return () => { active = false; cleanup(); };
  }, []);

  return null;
}

export function PwaStatus() {
  const online = useOnlineStatus();
  const waiting = useSyncExternalStore(subscribeUpdates, () => updateReady, () => false);
  if (online && !waiting) return null;

  return <aside aria-label="Connection and app updates" className="shrink-0 border-b border-border bg-surface px-4 py-2 text-xs text-foreground">
    <div role="status" aria-live="polite" className="mx-auto max-w-3xl space-y-1 break-words">
      {!online && <p>{OFFLINE_MUTATION_MESSAGE} Previously loaded content may be out of date.</p>}
      {waiting && <p>Update ready. Save your work, close all Cafe360 tabs, then reopen to update.</p>}
    </div>
  </aside>;
}
