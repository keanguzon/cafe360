import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlacesService } from "@/lib/services/places";
import type { CafeReference } from "@/lib/types/circle-cafe";

const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function providerId(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 512 || /[\x00-\x20]/.test(value.trim())) {
    throw new Error("Invalid café reference");
  }
  return value.trim();
}

async function authenticatedClient() {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) throw new Error("Authentication required");
  return client;
}

async function findCafe(client: Awaited<ReturnType<typeof createClient>>, column: string, id: string) {
  const { data, error } = await client.from("cafes").select("id").eq(column, id).maybeSingle();
  if (error) throw new Error("Could not read saved café");
  return typeof data?.id === "string" ? data.id : null;
}

export async function resolveCafeId(ref: CafeReference): Promise<string | null> {
  if (!ref || (ref.kind !== "internal" && ref.kind !== "provider")) throw new Error("Invalid café reference");
  const id = providerId(ref.id);
  if (ref.kind === "internal" && !UUID_PATTERN.test(id)) throw new Error("Invalid café reference");
  const client = await authenticatedClient();
  return findCafe(client, ref.kind === "internal" ? "id" : "provider_place_id", id);
}

export async function ingestCafe(id: string): Promise<{ internalId: string; providerId: string }> {
  const canonicalId = providerId(id);
  const client = await authenticatedClient();
  const existing = await findCafe(client, "provider_place_id", canonicalId);
  if (existing) return { internalId: existing, providerId: canonicalId };

  const admin = createAdminClient();
  const token = process.env.MAPBOX_SEARCH_TOKEN?.trim();
  if (!token) throw new Error("Missing MAPBOX_SEARCH_TOKEN for café storage");
  const { data: quota, error: quotaError } = await client.rpc("consume_places_quota", { p_route: "details" });
  if (quotaError || typeof quota?.allowed !== "boolean") throw new Error("Places quota is unavailable");
  if (!quota.allowed) throw new Error("Places request limit reached. Please try again shortly.");

  const cafe = await getPlacesService({ token }).getDetails(canonicalId);
  if (!cafe || cafe.id !== canonicalId || typeof cafe.name !== "string" ||
    !cafe.name.trim() || cafe.name.trim().length > 200 ||
    !Array.isArray(cafe.coordinates) || cafe.coordinates.length !== 2 ||
    !Number.isFinite(cafe.coordinates[0]) || !Number.isFinite(cafe.coordinates[1]) ||
    Math.abs(cafe.coordinates[0]) > 180 || Math.abs(cafe.coordinates[1]) > 90) {
    throw new Error("Invalid café details from provider");
  }
  const categories = Array.isArray(cafe.categories)
    ? cafe.categories.filter((value) => typeof value === "string" && value.length <= 100).slice(0, 20)
    : null;
  const price = cafe.priceLevel;
  // Insert once: stale concurrent saves must not overwrite an established snapshot.
  const { data, error } = await admin.from("cafes").upsert({
    provider_place_id: canonicalId,
    name: cafe.name.trim(),
    address: typeof cafe.address === "string" ? cafe.address.slice(0, 1000) : null,
    lng: cafe.coordinates[0], lat: cafe.coordinates[1], categories,
    price_level: typeof price === "number" && Number.isInteger(price) && price >= 1 && price <= 4 ? price : null,
    timezone: "Asia/Manila",
    cached_at: new Date().toISOString(),
  }, { onConflict: "provider_place_id", ignoreDuplicates: true }).select("id").maybeSingle();
  if (error) throw new Error("Could not store café details");
  const internalId = typeof data?.id === "string" ? data.id : await findCafe(client, "provider_place_id", canonicalId);
  if (!internalId) throw new Error("Café storage was not confirmed");
  return { internalId, providerId: canonicalId };
}
