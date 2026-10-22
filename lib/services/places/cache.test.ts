import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryPlacesCache } from "./index";

const response = (total: number) => ({ results: [], total });

describe("InMemoryPlacesCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("expires an entry when its age reaches the TTL", () => {
    const cache = new InMemoryPlacesCache(100);
    cache.set("coffee", response(1));

    vi.setSystemTime(new Date("2026-01-01T00:00:00.099Z"));
    expect(cache.get("coffee")?.total).toBe(1);

    vi.setSystemTime(new Date("2026-01-01T00:00:00.100Z"));
    expect(cache.get("coffee")).toBeNull();
  });

  it("evicts the oldest of 257 unique entries at the default capacity", () => {
    const cache = new InMemoryPlacesCache();
    for (let index = 0; index < 257; index += 1) {
      cache.set(`key-${index}`, response(index));
    }

    expect(cache.get("key-0")).toBeNull();
    expect(cache.get("key-1")?.total).toBe(1);
    expect(cache.get("key-256")?.total).toBe(256);
  });

  it("moves a replaced entry to the newest insertion position", () => {
    const cache = new InMemoryPlacesCache(10000, 2);
    cache.set("first", response(1));
    cache.set("second", response(2));
    cache.set("first", response(3));
    cache.set("third", response(4));

    expect(cache.get("first")?.total).toBe(3);
    expect(cache.get("second")).toBeNull();
    expect(cache.get("third")?.total).toBe(4);
  });

  it("prunes expired entries before capacity eviction", () => {
    const cache = new InMemoryPlacesCache(100, 2);
    cache.set("still-live", response(1));

    // A wall-clock adjustment can make an entry later in insertion order expire first.
    vi.setSystemTime(new Date("2025-12-31T23:59:59.000Z"));
    cache.set("expired", response(2));
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    cache.set("new", response(3));

    expect(cache.get("still-live")?.total).toBe(1);
    expect(cache.get("expired")).toBeNull();
    expect(cache.get("new")?.total).toBe(3);
  });

  it("uses separate keys for an absent radius and an explicit 1000 meters", () => {
    const withoutRadius = InMemoryPlacesCache.createSearchKey({ query: "coffee" });
    const withRadius = InMemoryPlacesCache.createSearchKey({ query: "coffee", radiusMeters: 1000 });

    expect(withoutRadius).not.toBe(withRadius);
  });

  it("preserves coordinate precision in search keys", () => {
    const first = InMemoryPlacesCache.createSearchKey({
      query: "coffee",
      coordinates: [120.9367, 14.4172],
    });
    const nearby = InMemoryPlacesCache.createSearchKey({
      query: "coffee",
      coordinates: [120.9368, 14.4172],
    });

    expect(first).not.toBe(nearby);
  });

  it("normalizes the default query and API limit in search keys", () => {
    const omittedDefaults = InMemoryPlacesCache.createSearchKey({});
    const explicitDefaults = InMemoryPlacesCache.createSearchKey({
      query: "  Coffee Cafe ",
      limit: 50,
    });

    expect(omittedDefaults).toBe(explicitDefaults);
  });

  it("rejects invalid TTL and entry-capacity values", () => {
    expect(() => new InMemoryPlacesCache(0)).toThrow(RangeError);
    expect(() => new InMemoryPlacesCache(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => new InMemoryPlacesCache(100, 0)).toThrow(RangeError);
    expect(() => new InMemoryPlacesCache(100, 1.5)).toThrow(RangeError);
    expect(() => new InMemoryPlacesCache(100, Number.NaN)).toThrow(RangeError);
  });
});
