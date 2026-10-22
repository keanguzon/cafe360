"use server";

import type { CafeReference } from "@/lib/types/circle-cafe";
import type { CafeSearchResult } from "@/lib/types/places";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const CAFE_COLUMNS = "id,provider_place_id,name,address,lat,lng,categories,price_level";

type CafeRow = {
  id?: unknown;
  provider_place_id?: unknown;
  name?: unknown;
  address?: unknown;
  lat?: unknown;
  lng?: unknown;
  categories?: unknown;
  price_level?: unknown;
};

export async function getCafeByReferenceAction(ref: CafeReference, expectedAccountId?: string): Promise<CafeSearchResult | null> {
  if (!ref || (ref.kind !== "internal" && ref.kind !== "provider") || typeof ref.id !== "string") return null;

  let lookupId: string;
  if (ref.kind === "internal") {
    if (!UUID_PATTERN.test(ref.id)) return null;
    lookupId = ref.id;
  } else {
    lookupId = ref.id.trim();
    if (!lookupId || lookupId.length > 512) return null;
  }

  if (!hasSupabaseConfig()) return null;

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user || (expectedAccountId && authData.user.id !== expectedAccountId)) return null;

  const column = ref.kind === "internal" ? "id" : "provider_place_id";
  const { data, error } = await supabase.from("cafes")
    .select(CAFE_COLUMNS)
    .eq(column, lookupId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as CafeRow;
  if (
    typeof row.id !== "string" || !row.id ||
    typeof row.provider_place_id !== "string" || !row.provider_place_id ||
    typeof row.name !== "string" ||
    typeof row.lat !== "number" || !Number.isFinite(row.lat) ||
    typeof row.lng !== "number" || !Number.isFinite(row.lng)
  ) return null;

  const cafe: CafeSearchResult = {
    id: row.provider_place_id,
    internalId: row.id,
    name: row.name,
    address: typeof row.address === "string" ? row.address : "",
    coordinates: [row.lng, row.lat],
  };

  if (Array.isArray(row.categories) && row.categories.every((category) => typeof category === "string")) {
    cafe.categories = row.categories;
  }
  if (typeof row.price_level === "number" && Number.isInteger(row.price_level) && row.price_level >= 1 && row.price_level <= 4) {
    cafe.priceLevel = row.price_level;
  }

  return cafe;
}
