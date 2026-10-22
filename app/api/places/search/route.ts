import { NextResponse, type NextRequest } from "next/server";
import { getPlacesService, globalSearchCache, InMemoryPlacesCache } from "@/lib/services/places";
import { guardPlacesRequest, hasPlacesProviderToken } from "@/lib/services/places/request-guard";
import { parsePlacesSearch, PlacesValidationError } from "@/lib/validation/places";

export async function GET(request: NextRequest) {
  let params;
  try {
    params = parsePlacesSearch(request.nextUrl.searchParams);
  } catch (error) {
    if (error instanceof PlacesValidationError) {
      return NextResponse.json({ error: error.message, results: [], total: 0 }, { status: 400 });
    }
    throw error;
  }

  const guard = await guardPlacesRequest("search");
  if (guard) return guard;
  if (!hasPlacesProviderToken()) {
    return NextResponse.json({ error: "Places service is unavailable" }, { status: 503 });
  }

  const cacheKey = InMemoryPlacesCache.createSearchKey(params);
  const cached = globalSearchCache.get(cacheKey);
  if (cached) return NextResponse.json({ ...cached, cached: true });

  try {
    const data = await getPlacesService().searchNearby(params);
    globalSearchCache.set(cacheKey, data);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Places provider is unavailable" }, { status: 502 });
  }
}
