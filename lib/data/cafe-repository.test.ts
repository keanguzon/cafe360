import { beforeEach, describe, expect, it, vi } from "vitest";
import { ingestCafe, resolveCafeId } from "./cafe-repository";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(),
  rpc: vi.fn(), admin: vi.fn(), adminFrom: vi.fn(), upsert: vi.fn(),
  adminSelect: vi.fn(), adminSingle: vi.fn(), getDetails: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: mocks.getUser }, from: mocks.from, rpc: mocks.rpc,
}) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/services/places", () => ({ getPlacesService: () => ({ getDetails: mocks.getDetails }) }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("MAPBOX_SEARCH_TOKEN", "test-server-token");
  mocks.getUser.mockResolvedValue({ data: { user: { id: "actor" } }, error: null });
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.rpc.mockResolvedValue({ data: { allowed: true }, error: null });
  mocks.admin.mockReturnValue({ from: mocks.adminFrom });
  mocks.adminFrom.mockReturnValue({ upsert: mocks.upsert });
  mocks.upsert.mockReturnValue({ select: mocks.adminSelect });
  mocks.adminSelect.mockReturnValue({ maybeSingle: mocks.adminSingle });
  mocks.adminSingle.mockResolvedValue({ data: { id: "internal-1" }, error: null });
  mocks.getDetails.mockResolvedValue({ id: "provider-1", name: "Trusted Café", address: "Bacoor",
    coordinates: [120.9, 14.4], categories: ["cafe"] });
});

describe("trusted café snapshot ingestion", () => {
  it("authenticates before privileged reads, provider requests or writes", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(ingestCafe("provider-1")).rejects.toThrow("Authentication required");
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.getDetails).not.toHaveBeenCalled();
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("persists provider metadata without a fabricated price or community rating", async () => {
    expect(await ingestCafe("provider-1")).toEqual({ internalId: "internal-1", providerId: "provider-1" });
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      provider_place_id: "provider-1", name: "Trusted Café", address: "Bacoor", lat: 14.4, lng: 120.9,
      price_level: null, timezone: "Asia/Manila",
    }), { onConflict: "provider_place_id", ignoreDuplicates: true });
    expect(mocks.upsert.mock.calls[0][0]).not.toHaveProperty("community_rating");
  });
  it("reuses the stored snapshot when provider is unavailable", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { id: "saved-id" }, error: null });
    mocks.getDetails.mockRejectedValue(new Error("offline"));
    expect(await ingestCafe("provider-1")).toEqual({ internalId: "saved-id", providerId: "provider-1" });
    expect(mocks.getDetails).not.toHaveBeenCalled();
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it.each([
    { id: "wrong-id" }, { coordinates: [181, 14] }, { coordinates: [120, NaN] }, { name: "" },
  ])("rejects invalid provider metadata %j without a write", async (overrides) => {
    mocks.getDetails.mockResolvedValue({ id: "provider-1", name: "Cafe", coordinates: [120, 14], ...overrides });
    await expect(ingestCafe("provider-1")).rejects.toThrow("Invalid café details");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("does not write on provider failure", async () => {
    mocks.getDetails.mockRejectedValue(new Error("Upstream unavailable"));
    await expect(ingestCafe("provider-1")).rejects.toThrow("Upstream unavailable");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("fails closed when quota is unavailable or exhausted", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "missing migration" } });
    await expect(ingestCafe("provider-1")).rejects.toThrow("quota is unavailable");
    mocks.rpc.mockResolvedValue({ data: { allowed: false }, error: null });
    await expect(ingestCafe("provider-1")).rejects.toThrow("request limit");
    expect(mocks.getDetails).not.toHaveBeenCalled();
  });
  it("handles concurrent ingestion by reading the winning row", async () => {
    mocks.adminSingle.mockResolvedValue({ data: null, error: null });
    mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: "winner" }, error: null });
    expect(await ingestCafe("provider-1")).toEqual({ internalId: "winner", providerId: "provider-1" });
  });
  it("fails clearly on missing admin configuration before querying provider", async () => {
    mocks.admin.mockImplementation(() => { throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY"); });
    await expect(ingestCafe("provider-1")).rejects.toThrow("SUPABASE_SERVICE_ROLE_KEY");
    expect(mocks.getDetails).not.toHaveBeenCalled();
  });
  it("resolves internal IDs separately from provider IDs", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { id: "resolved" }, error: null });
    expect(await resolveCafeId({ kind: "internal", id: "123e4567-e89b-12d3-a456-426614174000" })).toBe("resolved");
    expect(mocks.eq).toHaveBeenCalledWith("id", "123e4567-e89b-12d3-a456-426614174000");
    await expect(resolveCafeId({ kind: "internal", id: "provider-1" })).rejects.toThrow("Invalid café reference");
  });
});
