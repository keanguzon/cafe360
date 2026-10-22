import { NextResponse } from "next/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type PlacesRoute = "search" | "details";

export async function guardPlacesRequest(route: PlacesRoute): Promise<NextResponse | null> {
  let configured: boolean;
  try {
    configured = hasSupabaseConfig();
  } catch {
    return NextResponse.json({ error: "Places service is unavailable" }, { status: 503 });
  }
  if (!configured) {
    return NextResponse.json({ error: "Places service is unavailable" }, { status: 503 });
  }

  try {
    const client = await createClient();
    const { data: userData, error: authError } = await client.auth.getUser();
    if (authError || !userData.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data, error } = await client.rpc("consume_places_quota", { p_route: route });
    if (error || !data || typeof data !== "object" || typeof data.allowed !== "boolean") {
      return NextResponse.json({ error: "Places quota is unavailable" }, { status: 503 });
    }
    if (!data.allowed) {
      const retryAfter = Number(data.retryAfterSeconds);
      const seconds = Number.isFinite(retryAfter) ? Math.max(1, Math.ceil(retryAfter)) : 60;
      return NextResponse.json(
        { error: "Places request limit reached" },
        { status: 429, headers: { "Retry-After": String(seconds) } },
      );
    }
    return null;
  } catch {
    return NextResponse.json({ error: "Places service is unavailable" }, { status: 503 });
  }
}

export function hasPlacesProviderToken(): boolean {
  return Boolean(
    process.env.MAPBOX_SEARCH_TOKEN?.trim() || process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim(),
  );
}
