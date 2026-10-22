"use client";

import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { DEFAULT_MAP_CENTER, DEFAULT_ZOOM, type MapStyleKey } from "@/lib/services/map-service";

export type CircleSheetState = {scrollTop:number;snap:"peek"|"half"|"full"};
export type NavigationSnapshot = {
  map: {
    center: [number, number]; zoom: number; style: MapStyleKey; query: string;
    searchCoordinates: [number, number] | null;
    filterTopRated?: boolean;
  };
  discover: { query: string; filters: string[]; scrollTop: number; coordinates?: [number, number] };
  circleSheets: Record<string,CircleSheetState>;
  nearbyList: { query:string; coordinates:[number,number]; radiusMeters:number; limit:number; filterTopRated:boolean } | null;
};

export function createNavigationStore() {
  let snapshot: NavigationSnapshot = {
    map: { center: DEFAULT_MAP_CENTER, zoom: DEFAULT_ZOOM, style: "satellite", query: "", searchCoordinates: null },
    discover: { query: "", filters: [], scrollTop: 0 },
    circleSheets: {},
    nearbyList: null,
  };
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    update: (patch: Partial<NavigationSnapshot>) => {
      snapshot = { ...snapshot, ...patch };
      listeners.forEach((listener) => listener());
    },
  };
}

const NavigationContext = createContext<ReturnType<typeof createNavigationStore> | null>(null);

function AccountNavigationProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createNavigationStore);
  return <NavigationContext.Provider value={store}>{children}</NavigationContext.Provider>;
}

export function NavigationStateProvider({ accountId, children }: { accountId: string; children: ReactNode }) {
  return <AccountNavigationProvider key={accountId}>{children}</AccountNavigationProvider>;
}

export function useNavigationState() {
  const store = useContext(NavigationContext);
  if (!store) throw new Error("NavigationStateProvider is required");
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { ...snapshot, update: store.update, getSnapshot: store.getSnapshot };
}
