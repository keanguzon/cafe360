import { NextResponse, type NextRequest } from "next/server";
import { getPlacesService } from "@/lib/services/places";
import { guardPlacesRequest, hasPlacesProviderToken } from "@/lib/services/places/request-guard";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (id.length === 0 || id.length > 512) {
    return NextResponse.json({ error: "Invalid place id" }, { status: 400 });
  }

  const guard = await guardPlacesRequest("details");
  if (guard) return guard;
  if (!hasPlacesProviderToken()) {
    return NextResponse.json({ error: "Places service is unavailable" }, { status: 503 });
  }

  try {
    const details = await getPlacesService().getDetails(id);
    if (!details) {
      return NextResponse.json({ error: "Place details not found" }, { status: 404 });
    }
    return NextResponse.json(details);
  } catch {
    return NextResponse.json({ error: "Places provider is unavailable" }, { status: 502 });
  }
}
