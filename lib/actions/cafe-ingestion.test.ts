import { beforeEach, describe, expect, it, vi } from "vitest";
import { upsertCafeAction } from "./cafe-actions";
const mocks = vi.hoisted(() => ({ ingest: vi.fn() }));
vi.mock("@/lib/data/cafe-repository", () => ({ ingestCafe: mocks.ingest }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");
  mocks.ingest.mockResolvedValue({ internalId: "internal-id", providerId: "provider-1" });
});

describe("café save ingestion boundary", () => {
  it("passes only provider identity, ignoring browser supplied metadata", async () => {
    expect(await upsertCafeAction({ id: "provider-1", name: "Spoofed café", address: "Fake",
      coordinates: [0, 0], rating: 5, priceLevel: 4 })).toEqual({ success: true, cafeId: "internal-id" });
    expect(mocks.ingest).toHaveBeenCalledWith("provider-1");
  });
  it("returns a clear setup error without a permissive table write fallback", async () => {
    mocks.ingest.mockRejectedValue(new Error("Missing SUPABASE_SERVICE_ROLE_KEY for café storage"));
    expect(await upsertCafeAction({ id: "provider-1", name: "Cafe", address: "", coordinates: [120, 14] }))
      .toEqual({ success: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY for café storage" });
  });
});
