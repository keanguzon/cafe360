"use client";

import { useSyncExternalStore } from "react";

export const OFFLINE_MUTATION_MESSAGE = "You're offline. Keep this page open to preserve your draft, then reconnect and retry. Changes are not queued.";

export function isOnline() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function useOnlineStatus() {
  return useSyncExternalStore(subscribe, isOnline, () => true);
}
