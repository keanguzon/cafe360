// @vitest-environment jsdom

import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLocalLocation } from "./use-local-location";

type Location = ReturnType<typeof useLocalLocation>;
type Success = PositionCallback;
type Failure = PositionErrorCallback;

const currentCallbacks: Array<[Success, Failure]> = [];
const watchCallbacks: Array<[Success, Failure]> = [];
const getCurrentPosition = vi.fn((success: Success, failure: Failure) => {
  currentCallbacks.push([success, failure]);
});
const watchPosition = vi.fn((success: Success, failure: Failure) => {
  watchCallbacks.push([success, failure]);
  return 7;
});
const clearWatch = vi.fn();

let root: Root | null;
let container: HTMLDivElement;
let latest: Location;

function position(longitude: number, latitude: number, timestamp = Date.now(), accuracy = 15): GeolocationPosition {
  return {
    timestamp,
    coords: { longitude, latitude, accuracy, altitude: null, altitudeAccuracy: null, heading: null, speed: null, toJSON: () => ({}) },
    toJSON: () => ({}),
  };
}

function error(code: number): GeolocationPositionError {
  return { code, message: "Device location error", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };
}

function Probe() {
  const value = useLocalLocation();
  useEffect(() => { latest = value; }, [value]);
  return null;
}

function mount() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<Probe />));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-16T00:00:00.000Z"));
  vi.clearAllMocks();
  currentCallbacks.length = 0;
  watchCallbacks.length = 0;
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition, watchPosition, clearWatch } });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  root = null;
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  container?.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useLocalLocation", () => {
  it("starts without a fix and requests one position and one watch on mount", () => {
    mount();
    expect(latest.coordinates).toBeNull();
    expect(latest.status).toBe("locating");
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(watchPosition).toHaveBeenCalledTimes(1);
  });

  it("accepts a fresh fix in longitude-latitude order and ages it to stale", () => {
    mount();
    act(() => currentCallbacks[0][0](position(120.9367, 14.4172)));
    expect(latest).toMatchObject({ status: "ready", coordinates: [120.9367, 14.4172], accuracyMeters: 15, capturedAt: Date.now(), error: null });
    act(() => vi.advanceTimersByTime(60_001));
    expect(latest).toMatchObject({ status: "stale", coordinates: [120.9367, 14.4172] });
  });

  it("rejects invalid fixes and callbacks older than the latest accepted timestamp", () => {
    mount();
    const now = Date.now();
    act(() => watchCallbacks[0][0](position(121, 14, now)));
    act(() => currentCallbacks[0][0](position(120, 13, now - 1)));
    act(() => watchCallbacks[0][0](position(Infinity, 14, now + 1)));
    act(() => watchCallbacks[0][0](position(120, 91, now + 2)));
    act(() => watchCallbacks[0][0](position(120, 14, now + 3, -1)));
    expect(latest).toMatchObject({ status: "ready", coordinates: [121, 14], capturedAt: now });
  });

  it("shows denial and allows a manual retry without starting another watch", () => {
    mount();
    act(() => currentCallbacks[0][1](error(1)));
    expect(latest.status).toBe("denied");
    expect(latest.coordinates).toBeNull();
    expect(latest.error).toBeTruthy();
    act(() => latest.requestLocation());
    expect(latest.status).toBe("locating");
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(watchPosition).toHaveBeenCalledTimes(1);
    act(() => currentCallbacks[1][0](position(121, 15)));
    expect(latest.status).toBe("ready");
  });

  it.each([2, 3])("shows unavailable for position error code %i", (code) => {
    mount();
    act(() => currentCallbacks[0][1](error(code)));
    expect(latest.status).toBe("unavailable");
    expect(latest.coordinates).toBeNull();
  });

  it("shows unavailable when geolocation is missing", () => {
    vi.stubGlobal("navigator", {});
    mount();
    expect(latest.status).toBe("unavailable");
    expect(latest.coordinates).toBeNull();
  });

  it("shows unavailable when the watch API is missing", () => {
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition, clearWatch } });
    mount();
    expect(latest.status).toBe("unavailable");
  });

  it("keeps a last-known fix explicitly stale when a retry times out", () => {
    mount();
    act(() => currentCallbacks[0][0](position(121, 14)));
    act(() => vi.advanceTimersByTime(60_001));
    act(() => latest.requestLocation());
    act(() => currentCallbacks[1][1](error(3)));
    expect(latest).toMatchObject({ status: "stale", coordinates: [121, 14] });
    expect(latest.error).toBeTruthy();
  });

  it("rechecks age when the page becomes visible", () => {
    mount();
    act(() => currentCallbacks[0][0](position(121, 14)));
    vi.setSystemTime(Date.now() + 70_000);
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(latest.status).toBe("stale");
  });

  it("clears the watch and ignores late callbacks after unmount", () => {
    mount();
    act(() => root?.unmount());
    root = null;
    expect(clearWatch).toHaveBeenCalledWith(7);
    const prior = latest;
    act(() => currentCallbacks[0][0](position(121, 14)));
    act(() => watchCallbacks[0][1](error(1)));
    expect(latest).toBe(prior);
  });
});
