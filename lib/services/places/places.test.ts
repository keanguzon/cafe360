import { describe, expect, it, vi, beforeEach } from "vitest";
import { getPlacesService, InMemoryPlacesCache } from "./index";
import { MapboxPlacesProvider } from "./mapbox-provider";

describe("PlacesService & MapboxProvider", () => {
  it("filters addresses from café text search instead of inventing café categories", async () => {
    const provider = new MapboxPlacesProvider({ token: "test-token" });
    const feature = (id: string, properties: Record<string, unknown>) => ({ id, geometry: { type: "Point", coordinates: [121, 14] }, properties: { name: id, ...properties } });
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: true, json: async () => ({ features: [
      feature("address", { feature_type: "address" }),
      feature("cafe", { feature_type: "poi", poi_category: ["Coffee Shop"] }),
      feature("hardware", { feature_type: "poi", poi_category: ["Hardware Store"] }),
    ] }) } as Response);
    const result = await provider.searchText({ query: "Starbucks" });
    expect(result.results.map((item) => item.id)).toEqual(["cafe"]);
    expect(result.results[0].priceLevel).toBeUndefined();
    expect(new URL(vi.mocked(fetch).mock.calls[0][0] as string).searchParams.get("types")).toBe("poi");
  });
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes MapboxPlacesProvider as the default provider", () => {
    const service = getPlacesService({ token: "sk.test_token" });
    expect(service.name).toBe("mapbox");
  });

  it("handles in-memory caching for repeated search queries", async () => {
    const cache = new InMemoryPlacesCache(1000); // 1 sec TTL
    const mockData = { results: [], total: 0 };

    expect(cache.get("test-key")).toBeNull();
    cache.set("test-key", mockData);
    expect(cache.get("test-key")).toEqual(mockData);

    // Verify key generator creates consistent hashes
    const key1 = InMemoryPlacesCache.createSearchKey({ query: "coffee", coordinates: [120.9367, 14.4172] });
    const key2 = InMemoryPlacesCache.createSearchKey({ coordinates: [120.9367, 14.4172], query: "coffee" });
    expect(key1).toBe(key2);
  });

  it("transforms Mapbox GeoJSON features into standardized CafeSearchResult format", () => {
    const provider = new MapboxPlacesProvider({ token: "sk.test_token" });
    const mockFeature = {
      id: "place.12345",
      geometry: {
        type: "Point",
        coordinates: [120.9367, 14.4172] as [number, number],
      },
      properties: {
        name: "Coffee Project Imus",
        full_address: "Coffee Project, Emilio Aguinaldo Hwy, Imus, Cavite",
        poi_category: ["coffee shop", "cafe"],
      },
    };

    const transformed = provider.transformFeatureToResult(mockFeature, [120.9367, 14.4172]);
    expect(transformed.id).toBe("place.12345");
    expect(transformed.name).toBe("Coffee Project Imus");
    expect(transformed.address).toBe("Coffee Project, Emilio Aguinaldo Hwy, Imus, Cavite");
    expect(transformed.coordinates).toEqual([120.9367, 14.4172]);
    expect(transformed.categories).toContain("coffee shop");
  });

  it("surfaces fetch failures instead of treating them as zero results", async () => {
    const provider = new MapboxPlacesProvider({ token: "sk.test_token" });
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network connection lost"));

    await expect(provider.searchNearby({
      coordinates: [120.9367, 14.4172],
      query: "coffee",
    })).rejects.toThrow("Network connection lost");
  });

  it("requests one category batch of at most 25 and filters to the radius", async () => {
    const provider = new MapboxPlacesProvider({ token: "sk.test_token" });
    const feature = (id: string, longitude: number) => ({ id, geometry: { type: "Point", coordinates: [longitude, 14] }, properties: { name: id } });
    const fetcher = vi.spyOn(global, "fetch").mockResolvedValue({ ok: true, json: async () => ({ features: [feature("near", 120), feature("far", 121)] }) } as Response);
    const response = await provider.searchNearby({ query: "coffee cafe", coordinates: [120, 14], radiusMeters: 1500, limit: 50 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const url = new URL(fetcher.mock.calls[0][0] as string);
    expect(url.pathname).toBe("/search/searchbox/v1/category/coffee");
    expect(url.searchParams.get("limit")).toBe("25");
    expect(response.results.map((item) => item.id)).toEqual(["near"]);
  });

  it("throws for failed details and never invents opening hours", async () => {
    const provider = new MapboxPlacesProvider({ token: "sk.test_token" });
    const fetcher = vi.spyOn(global, "fetch").mockResolvedValueOnce({ ok: false, status: 403 } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ mapbox_id: "place-1", name: "Cafe", full_address: "Main St", coordinates: { longitude: 120, latitude: 14 } }) } as Response);
    await expect(provider.getDetails("place-1")).rejects.toThrow("403");
    const details = await provider.getDetails("place-1");
    expect(details?.openingHours).toBeUndefined();
    const url = new URL(fetcher.mock.calls[1][0] as string);
    expect(url.pathname).toBe("/places/v1/details/retrieve/place-1");
    expect(url.searchParams.has("session_token")).toBe(false);
  });

  it("bounds provider requests with an abort signal", async () => {
    const provider = new MapboxPlacesProvider({ token: "sk.test_token" });
    const fetcher = vi.spyOn(global, "fetch").mockResolvedValue({ ok: true, json: async () => ({ features: [] }) } as Response);
    await provider.searchNearby({ query: "coffee", coordinates: [120, 14] });
    expect(fetcher.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("rejects malformed upstream coordinates rather than returning fabricated cafes", async () => {
    const provider = new MapboxPlacesProvider({ token: "sk.test_token" });
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: true, json: async () => ({ features: [{ geometry: { coordinates: [Infinity, 14] }, properties: { name: "Cafe" } }] }) } as Response);
    await expect(provider.searchNearby({ query: "coffee" })).rejects.toThrow("Invalid Mapbox feature");
  });
});
