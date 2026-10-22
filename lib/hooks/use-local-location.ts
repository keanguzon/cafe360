"use client";

import { useState, useSyncExternalStore } from "react";

export type LocationStatus = "idle" | "locating" | "ready" | "denied" | "unavailable" | "stale";

type LocationSnapshot = {
  status: LocationStatus;
  coordinates: [number, number] | null;
  accuracyMeters: number | null;
  capturedAt: number | null;
  error: string | null;
  requestLocation: () => void;
};

const FRESH_FOR_MS = 60_000;
const POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 0,
};

function createLocationStore() {
  let listener: (() => void) | null = null;
  let active = false;
  let watchId: number | null = null;
  let staleTimer: ReturnType<typeof setTimeout> | null = null;
  let newestTimestamp: number | null = null;
  let requestId = 0;

  const requestLocation = () => {
    if (!active) return;
    const geo = typeof navigator !== "undefined" ? navigator.geolocation : undefined;
    if (!geo || typeof geo.getCurrentPosition !== "function" || typeof geo.watchPosition !== "function") {
      fail("unavailable", "Geolocation is unavailable on this device.");
      return;
    }

    const thisRequest = ++requestId;
    publish({ ...snapshot, status: "locating", error: null });
    try {
      geo.getCurrentPosition(
        (position) => accept(position),
        (error) => {
          if (thisRequest === requestId) reject(error);
        },
        POSITION_OPTIONS,
      );
    } catch {
      fail("unavailable", "Geolocation is unavailable on this device.");
    }
  };

  let snapshot: LocationSnapshot = {
    status: "idle",
    coordinates: null,
    accuracyMeters: null,
    capturedAt: null,
    error: null,
    requestLocation,
  };

  function publish(next: LocationSnapshot) {
    if (!active) return;
    snapshot = next;
    listener?.();
  }

  function clearStaleTimer() {
    if (staleTimer !== null) clearTimeout(staleTimer);
    staleTimer = null;
  }

  function refreshAge() {
    if (!active || snapshot.capturedAt === null || snapshot.coordinates === null) return;
    clearStaleTimer();
    if (Date.now() - snapshot.capturedAt > FRESH_FOR_MS) {
      if (snapshot.status === "ready" || snapshot.status === "locating") {
        publish({ ...snapshot, status: "stale" });
      }
      return;
    }
    staleTimer = setTimeout(refreshAge, Math.max(1, snapshot.capturedAt + FRESH_FOR_MS + 1 - Date.now()));
  }

  function accept(position: GeolocationPosition) {
    if (!active) return;
    const { longitude, latitude, accuracy } = position.coords;
    const timestamp = position.timestamp;
    if (
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
      !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(accuracy) || accuracy < 0 ||
      !Number.isFinite(timestamp) ||
      (newestTimestamp !== null && timestamp < newestTimestamp)
    ) return;

    newestTimestamp = timestamp;
    publish({
      ...snapshot,
      status: Date.now() - timestamp > FRESH_FOR_MS ? "stale" : "ready",
      coordinates: [longitude, latitude],
      accuracyMeters: accuracy,
      capturedAt: timestamp,
      error: null,
    });
    refreshAge();
  }

  function fail(status: "denied" | "unavailable", message: string) {
    if (!active) return;
    clearStaleTimer();
    publish({
      ...snapshot,
      status,
      coordinates: null,
      accuracyMeters: null,
      capturedAt: null,
      error: message,
    });
  }

  function reject(error: GeolocationPositionError) {
    if (!active) return;
    if (error.code === error.PERMISSION_DENIED) {
      fail("denied", "Location permission denied. Allow location access and try again.");
    } else if (snapshot.status !== "ready") {
      const message = error.code === error.TIMEOUT
        ? "Location request timed out. Try again."
        : "Location is unavailable. Try again.";
      if (snapshot.coordinates !== null) {
        publish({ ...snapshot, status: "stale", error: message });
      } else {
        fail("unavailable", message);
      }
    }
  }

  const subscribe = (onStoreChange: () => void) => {
    listener = onStoreChange;
    active = true;
    requestLocation();
    const geo = typeof navigator !== "undefined" ? navigator.geolocation : undefined;
    if (geo && typeof geo.watchPosition === "function") {
      try {
        watchId = geo.watchPosition(accept, reject, POSITION_OPTIONS);
      } catch {
        if (snapshot.status !== "ready") fail("unavailable", "Location watch is unavailable.");
      }
    }
    document.addEventListener("visibilitychange", refreshAge);

    return () => {
      active = false;
      listener = null;
      requestId++;
      clearStaleTimer();
      document.removeEventListener("visibilitychange", refreshAge);
      if (watchId !== null) geo?.clearWatch(watchId);
      watchId = null;
    };
  };

  return { subscribe, getSnapshot: () => snapshot };
}

export function useLocalLocation(): LocationSnapshot {
  const [store] = useState(createLocationStore);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
