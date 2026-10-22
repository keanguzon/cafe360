import type { SearchParams, SearchResponse } from "@/lib/types/places";
import { MapboxPlacesProvider } from "./mapbox-provider";
import type { PlacesProvider } from "./types";

export class InMemoryPlacesCache {
  private cache: Map<string, { data: SearchResponse; timestamp: number }> = new Map();
  private ttlMs: number;
  private maxEntries: number;

  constructor(ttlMs: number = 60000, maxEntries: number = 256) {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new RangeError("ttlMs must be a positive finite number");
    }
    if (!Number.isFinite(maxEntries) || !Number.isInteger(maxEntries) || maxEntries <= 0) {
      throw new RangeError("maxEntries must be a positive finite integer");
    }

    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
  }

  public static createSearchKey(params: SearchParams): string {
    const query = (params.query?.trim() || "coffee cafe").toLowerCase();
    const coordinates = params.coordinates ?? null;
    const limit = params.limit ?? 50;
    const radius = params.radiusMeters ?? null;
    return `search:${JSON.stringify([query, coordinates, limit, radius])}`;
  }

  public get(key: string): SearchResponse | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp >= this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  public set(key: string, data: SearchResponse): void {
    const now = Date.now();
    this.pruneExpired(now);

    // Map preserves insertion order, so deleting before setting refreshes this entry's age.
    this.cache.delete(key);
    this.cache.set(key, { data, timestamp: now });

    while (this.cache.size > this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) break;
      this.cache.delete(oldestKey);
    }
  }

  private pruneExpired(now: number): void {
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp >= this.ttlMs) {
        this.cache.delete(key);
      }
    }
  }

  public clear(): void {
    this.cache.clear();
  }
}

// Global in-memory cache instance
const globalSearchCache = new InMemoryPlacesCache(1000 * 60 * 3, 256); // 3 minutes

export function getPlacesService(options?: { token?: string }): PlacesProvider {
  return new MapboxPlacesProvider(options);
}

export { globalSearchCache };
export * from "./types";
export * from "./mapbox-provider";
