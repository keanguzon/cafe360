import type { SearchParams } from "@/lib/types/places";

export class PlacesValidationError extends Error {}

function boundedNumber(raw: string | null, name: string, min: number, max: number, integer = false): number {
  if (raw === null || raw.trim() === "") throw new PlacesValidationError(`${name} is required`);
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new PlacesValidationError(`Invalid ${name}`);
  }
  return value;
}

export function parsePlacesSearch(input: URLSearchParams): SearchParams {
  const query = input.get("q")?.trim() || "coffee cafe";
  if (query.length < 2 || query.length > 200) {
    throw new PlacesValidationError("Query must be 2 to 200 characters long");
  }

  const lat = input.get("lat");
  const lng = input.get("lng");
  if ((lat === null) !== (lng === null)) {
    throw new PlacesValidationError("Latitude and longitude must be provided together");
  }

  const params: SearchParams = {
    query,
    limit: input.has("limit") ? boundedNumber(input.get("limit"), "limit", 1, 50, true) : 50,
  };
  if (lat !== null && lng !== null) {
    params.coordinates = [boundedNumber(lng, "longitude", -180, 180), boundedNumber(lat, "latitude", -90, 90)];
  }
  if (input.has("radius")) {
    params.radiusMeters = boundedNumber(input.get("radius"), "radius", 100, 10000, true);
  }
  return params;
}
