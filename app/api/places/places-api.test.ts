import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getPlacesService: vi.fn(),
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/services/places", () => ({
  getPlacesService: mocks.getPlacesService,
  globalSearchCache: { get: mocks.cacheGet, set: mocks.cacheSet },
  InMemoryPlacesCache: { createSearchKey: () => "key" },
}));

import { GET as searchHandler } from "./search/route";
import { GET as detailsHandler } from "./details/route";

const request = (path: string) => new NextRequest(`http://localhost:3000/api/places/${path}`);
const result = { results: [{ id: "place-1", name: "Cafe", address: "Main St", coordinates: [120, 14] }], total: 1 };
const searchNearby = vi.fn();
const getDetails = vi.fn();
const getUser = vi.fn();
const rpc = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-key");
  vi.stubEnv("MAPBOX_SEARCH_TOKEN", "server-token");
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  rpc.mockResolvedValue({ data: { allowed: true, retryAfterSeconds: 0 }, error: null });
  mocks.createClient.mockResolvedValue({ auth: { getUser }, rpc });
  mocks.getPlacesService.mockReturnValue({ searchNearby, getDetails });
  searchNearby.mockResolvedValue(result);
  getDetails.mockResolvedValue(result.results[0]);
  mocks.cacheGet.mockReturnValue(null);
});

describe("Places API guards", () => {
  it("rejects an unauthenticated search without quota or provider access", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await searchHandler(request("search?q=cafe"))).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
    expect(searchNearby).not.toHaveBeenCalled();
    expect(mocks.cacheGet).not.toHaveBeenCalled();
  });

  it.each(["q=a", "q=cafe&lat=91&lng=120", "q=cafe&radius=12", "q=cafe&lat=14abc&lng=120"])("rejects invalid search %s", async (query) => {
    expect((await searchHandler(request(`search?${query}`))).status).toBe(400);
    expect(searchNearby).not.toHaveBeenCalled();
  });

  it("denies exhausted search quota with Retry-After", async () => {
    rpc.mockResolvedValue({ data: { allowed: false, retryAfterSeconds: 19 }, error: null });
    const response = await searchHandler(request("search?q=cafe"));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("19");
    expect(searchNearby).not.toHaveBeenCalled();
    expect(mocks.cacheGet).not.toHaveBeenCalled();
  });

  it("returns a cached search after authentication and quota", async () => {
    mocks.cacheGet.mockReturnValue(result);
    const response = await searchHandler(request("search?q=cafe"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ...result, cached: true });
    expect(rpc).toHaveBeenCalledWith("consume_places_quota", { p_route: "search" });
    expect(searchNearby).not.toHaveBeenCalled();
  });

  it("caches a successful fresh response", async () => {
    const response = await searchHandler(request("search?q=cafe"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(mocks.cacheSet).toHaveBeenCalledWith("key", result);
  });

  it("returns 503 when quota RPC fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "private token" } });
    const response = await searchHandler(request("search?q=cafe"));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("private token");
    expect(searchNearby).not.toHaveBeenCalled();
  });

  it("returns 502 without leaking provider errors", async () => {
    searchNearby.mockRejectedValue(new Error("private token"));
    const response = await searchHandler(request("search?q=cafe"));
    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("private token");
  });

  it("returns 503 without provider configuration", async () => {
    vi.stubEnv("MAPBOX_SEARCH_TOKEN", "");
    const response = await searchHandler(request("search?q=cafe"));
    expect(response.status).toBe(503);
    expect(searchNearby).not.toHaveBeenCalled();
  });

  it("fails closed when authentication is unavailable even in demo mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    const response = await searchHandler(request("search?q=cafe"));
    expect(response.status).toBe(503);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(searchNearby).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated details without provider access", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await detailsHandler(request("details?id=abc"))).status).toBe(401);
    expect(getDetails).not.toHaveBeenCalled();
  });

  it.each(["", " ", "x".repeat(513)])("rejects invalid details ID", async (id) => {
    expect((await detailsHandler(request(`details?id=${encodeURIComponent(id)}`))).status).toBe(400);
    expect(getDetails).not.toHaveBeenCalled();
  });

  it("denies exhausted details quota", async () => {
    rpc.mockResolvedValue({ data: { allowed: false, retryAfterSeconds: 7 }, error: null });
    const response = await detailsHandler(request("details?id=abc"));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("7");
    expect(getDetails).not.toHaveBeenCalled();
  });

  it("returns details and reports a missing place", async () => {
    expect((await detailsHandler(request("details?id=abc"))).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("consume_places_quota", { p_route: "details" });
    getDetails.mockResolvedValue(null);
    expect((await detailsHandler(request("details?id=abc"))).status).toBe(404);
  });
});
