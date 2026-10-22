import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCafeByReferenceAction } from "./cafe-details-actions";
import type { CafeReference } from "@/lib/types/circle-cafe";

const mocks = vi.hoisted(() => ({
  hasSupabaseConfig: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseConfig: mocks.hasSupabaseConfig,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  }),
}));

const internalId = "123e4567-e89b-12d3-a456-426614174000";
const selectedColumns = "id,provider_place_id,name,address,lat,lng,categories,price_level";

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: internalId,
    provider_place_id: "provider-cafe-1",
    name: "Cafe One",
    address: "1 Main Street",
    lat: 14.4,
    lng: 120.9,
    categories: ["coffee", "cafe"],
    price_level: 3,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasSupabaseConfig.mockReturnValue(true);
  mocks.getUser.mockResolvedValue({ data: { user: { id: "member-1" } }, error: null });
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
  mocks.maybeSingle.mockResolvedValue({ data: makeRow(), error: null });
});

describe("getCafeByReferenceAction", () => {
  it("reads an internal café by database ID and keeps its provider ID separate", async () => {
    const result = await getCafeByReferenceAction({ kind: "internal", id: internalId });

    expect(mocks.from).toHaveBeenCalledWith("cafes");
    expect(mocks.select).toHaveBeenCalledWith(selectedColumns);
    expect(mocks.eq).toHaveBeenCalledWith("id", internalId);
    expect(result).toEqual({
      id: "provider-cafe-1",
      internalId,
      name: "Cafe One",
      address: "1 Main Street",
      coordinates: [120.9, 14.4],
      categories: ["coffee", "cafe"],
      priceLevel: 3,
    });
  });

  it("reads a provider reference by the trimmed provider ID", async () => {
    const ref: CafeReference = { kind: "provider", id: "  provider-cafe-1  " };

    const result = await getCafeByReferenceAction(ref);

    expect(mocks.eq).toHaveBeenCalledWith("provider_place_id", "provider-cafe-1");
    expect(result).toMatchObject({ id: "provider-cafe-1", internalId });
  });

  it("returns null in demo mode without creating a Supabase client", async () => {
    mocks.hasSupabaseConfig.mockReturnValue(false);

    await expect(getCafeByReferenceAction({ kind: "internal", id: internalId })).resolves.toBeNull();

    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns null without querying when there is no authenticated user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(getCafeByReferenceAction({ kind: "internal", id: internalId })).resolves.toBeNull();

    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns null without querying when authentication fails", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: "session unavailable" } });

    await expect(getCafeByReferenceAction({ kind: "internal", id: internalId })).resolves.toBeNull();

    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns null without querying for an invalid internal UUID", async () => {
    await expect(getCafeByReferenceAction({ kind: "internal", id: "not-a-uuid" })).resolves.toBeNull();

    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns null without querying for a blank or overlong provider ID", async () => {
    await expect(getCafeByReferenceAction({ kind: "provider", id: "   " })).resolves.toBeNull();
    await expect(getCafeByReferenceAction({ kind: "provider", id: "p".repeat(513) })).resolves.toBeNull();

    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns null when the authenticated lookup finds no café", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(getCafeByReferenceAction({ kind: "internal", id: internalId })).resolves.toBeNull();
  });

  it("throws database errors to the caller", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: "database unavailable" } });

    await expect(getCafeByReferenceAction({ kind: "internal", id: internalId })).rejects.toThrow("database unavailable");
  });

  it("maps only canonical café fields and ignores malformed optional values", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: makeRow({ address: null, categories: ["coffee", 12], price_level: 5 }),
      error: null,
    });

    const result = await getCafeByReferenceAction({ kind: "internal", id: internalId });

    expect(result).toEqual({
      id: "provider-cafe-1",
      internalId,
      name: "Cafe One",
      address: "",
      coordinates: [120.9, 14.4],
    });
    expect(mocks.select).toHaveBeenCalledWith(selectedColumns);
    expect(result).not.toHaveProperty("rating");
    expect(result).not.toHaveProperty("ratingCount");
  });
});

it("rejects a read captured for another account before any café lookup", async () => {
 await expect(getCafeByReferenceAction({kind:"provider",id:"provider-cafe-1"}, "former-account")).resolves.toBeNull();
 expect(mocks.from).not.toHaveBeenCalled();
});
