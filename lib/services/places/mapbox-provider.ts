import type {
  CafeDetails,
  CafeSearchResult,
  CoordinateTuple,
  SearchParams,
  SearchResponse,
} from "@/lib/types/places";
import type { PlacesProvider } from "./types";

export function calculateDistanceInMeters(
  coord1: CoordinateTuple,
  coord2: CoordinateTuple,
): number {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;

  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export type SearchBoxFeature = {
  id?: string;
  type?: string;
  geometry: {
    type: string;
    coordinates: [number, number];
  };
  properties: {
    feature_type?: string;
    mapbox_id?: string;
    name?: string;
    name_preferred?: string;
    full_address?: string;
    place_formatted?: string;
    address?: string;
    poi_category?: string[];
    category?: string;
    metadata?: {
      phone?: string;
      website?: string;
      rating?: number;
    };
  };
};

export type SearchBoxResponse = {
  type: string;
  features: SearchBoxFeature[];
  attribution?: string;
};

export class MapboxPlacesProvider implements PlacesProvider {
  public readonly name = "mapbox";
  private token: string;

  constructor(options?: { token?: string }) {
    this.token =
      options?.token ||
      process.env.MAPBOX_SEARCH_TOKEN ||
      process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
      "";
  }

  public transformFeatureToResult(
    feature: SearchBoxFeature,
    originCoords?: CoordinateTuple,
  ): CafeSearchResult {
    const rawCoords = feature?.geometry?.coordinates;
    if (!Array.isArray(rawCoords) || rawCoords.length !== 2 ||
        !Number.isFinite(rawCoords[0]) || !Number.isFinite(rawCoords[1]) ||
        rawCoords[0] < -180 || rawCoords[0] > 180 || rawCoords[1] < -90 || rawCoords[1] > 90 ||
        !(feature.properties?.mapbox_id || feature.id) ||
        !(feature.properties?.name || feature.properties?.name_preferred)) {
      throw new Error("Invalid Mapbox feature");
    }
    const coords: CoordinateTuple = [
      feature.geometry.coordinates[0],
      feature.geometry.coordinates[1],
    ];

    let distanceMeters: number | undefined;
    if (originCoords) {
      distanceMeters = calculateDistanceInMeters(originCoords, coords);
    }

    const categories =
      feature.properties?.poi_category ||
      (feature.properties?.category
        ? feature.properties.category.split(",").map((c) => c.trim().toLowerCase())
        : []);

    const id = feature.properties?.mapbox_id || feature.id!;
    const name = feature.properties?.name || feature.properties?.name_preferred || "";
    const address =
      feature.properties?.full_address ||
      feature.properties?.place_formatted ||
      feature.properties?.address ||
      "";

    return {
      id,
      name,
      address,
      coordinates: coords,
      distanceMeters,
      categories,
      rating: undefined,
      ratingCount: 0,
    };
  }

  public async searchNearby(params: SearchParams): Promise<SearchResponse> {
    const query = params.query?.trim();
    if (!query || query === "coffee" || query === "coffee cafe" || query === "cafe") {
      return this.executeCategorySearch("coffee", params);
    }
    return this.executeForwardSearch(query, params);
  }

  public async searchText(params: SearchParams): Promise<SearchResponse> {
    const query = params.query?.trim() || "coffee";
    return this.executeForwardSearch(query, params);
  }

  private async executeCategorySearch(
    category: string,
    params: SearchParams,
  ): Promise<SearchResponse> {
    if (!this.token) {
      throw new Error("Mapbox token is unavailable");
    }

    try {
      const categoriesToFetch = [category];
      
      const fetchCategory = async (cat: string) => {
        const url = new URL(
          `https://api.mapbox.com/search/searchbox/v1/category/${encodeURIComponent(cat)}`,
        );
        url.searchParams.set("access_token", this.token);
        url.searchParams.set("limit", String(Math.min(params.limit ?? 25, 25)));

        if (params.coordinates) {
          url.searchParams.set(
            "proximity",
            `${params.coordinates[0]},${params.coordinates[1]}`,
          );

          if (params.radiusMeters) {
            const [lng, lat] = params.coordinates;
            const radiusLat = params.radiusMeters / 111320;
            const radiusLng = params.radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));
            const minLng = lng - radiusLng;
            const minLat = lat - radiusLat;
            const maxLng = lng + radiusLng;
            const maxLat = lat + radiusLat;
            url.searchParams.set("bbox", `${minLng},${minLat},${maxLng},${maxLat}`);
          }
        }

        const response = await fetch(url.toString(), { cache: "no-store", signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error(`Mapbox category search failed (${response.status})`);
        return response.json() as Promise<SearchBoxResponse>;
      };

      const responses = await Promise.all(categoriesToFetch.map(fetchCategory));
      
      // Merge and deduplicate
      const uniqueResults = new Map<string, CafeSearchResult>();
      let attribution = "";

      for (const data of responses) {
        if (!data || !Array.isArray(data.features)) throw new Error("Invalid Mapbox category response");
        if (data.attribution) attribution = data.attribution;
        
        const results = (data.features || []).map((f) =>
          this.transformFeatureToResult(f, params.coordinates),
        );
        
        for (const res of results) {
          if (!uniqueResults.has(res.id)) {
            uniqueResults.set(res.id, res);
          }
        }
      }

      let finalResults = Array.from(uniqueResults.values());

      if (params.coordinates && params.radiusMeters !== undefined) {
        finalResults = finalResults.filter((result) => (result.distanceMeters ?? Infinity) <= params.radiusMeters!);
      }
      if (params.coordinates) {
        finalResults.sort(
          (a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity),
        );
      }
      
      // Limit to the requested limit (or 25 default for map view)
      const targetLimit = params.limit || 25;
      finalResults = finalResults.slice(0, targetLimit);

      return {
        results: finalResults,
        total: finalResults.length,
        attribution: attribution,
      };
    } catch (err) { throw err; }
  }

  private async executeForwardSearch(
    queryText: string,
    params: SearchParams,
  ): Promise<SearchResponse> {
    if (!this.token) {
      throw new Error("Mapbox token is unavailable");
    }

    try {
      const url = new URL(
        `https://api.mapbox.com/search/searchbox/v1/forward`,
      );
      url.searchParams.set("q", queryText);
      url.searchParams.set("types", "poi");
      url.searchParams.set("access_token", this.token);
      url.searchParams.set("limit", String(Math.min(params.limit || 10, 10)));

      if (params.coordinates) {
        url.searchParams.set(
          "proximity",
          `${params.coordinates[0]},${params.coordinates[1]}`,
        );

        if (params.radiusMeters) {
          const [lng, lat] = params.coordinates;
          const radiusLat = params.radiusMeters / 111320;
          const radiusLng = params.radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));
          const minLng = lng - radiusLng;
          const minLat = lat - radiusLat;
          const maxLng = lng + radiusLng;
          const maxLat = lat + radiusLat;
          url.searchParams.set("bbox", `${minLng},${minLat},${maxLng},${maxLat}`);
        }
      }

      const response = await fetch(url.toString(), { cache: "no-store", signal: AbortSignal.timeout(8000) });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.error("[PlacesProvider] Forward search failed:", response.status, errorText);
        throw new Error(`Mapbox forward search failed (${response.status})`);
      }

      const data: SearchBoxResponse = await response.json();
      if (!Array.isArray(data.features)) throw new Error("Invalid Mapbox forward response");
      let results = data.features.filter((feature) => {
        if (feature.properties?.feature_type && feature.properties.feature_type !== "poi") return false;
        const labels = feature.properties?.poi_category ?? feature.properties?.category?.split(",") ?? [];
        return labels.some((label) => /coffee|caf[eé]/i.test(label));
      }).map((f) =>
        this.transformFeatureToResult(f, params.coordinates),
      );

      if (params.coordinates && params.radiusMeters !== undefined) {
        results = results.filter((result) => (result.distanceMeters ?? Infinity) <= params.radiusMeters!);
      }
      if (params.coordinates) {
        results.sort(
          (a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity),
        );
      }

      return {
        results,
        total: results.length,
        attribution: data.attribution,
      };
    } catch (err) { throw err; }
  }

  public async getDetails(id: string): Promise<CafeDetails | null> {
    if (!this.token) throw new Error("Mapbox token is unavailable");
    if (!id) return null;

    try {
      const url = new URL(
        `https://api.mapbox.com/places/v1/details/retrieve/${encodeURIComponent(id)}`,
      );
      url.searchParams.set("access_token", this.token);

      const response = await fetch(url.toString(), { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!response.ok) {
        throw new Error(`Mapbox details failed (${response.status})`);
      }

      const data: unknown = await response.json();
      if (!data || typeof data !== "object") throw new Error("Invalid Mapbox details response");
      const place = data as Record<string, unknown>;
      const point = place.coordinates as Record<string, unknown> | undefined;
      if (typeof place.mapbox_id !== "string" || place.mapbox_id !== id ||
          typeof place.name !== "string" || !place.name.trim() ||
          !point || typeof point.longitude !== "number" || !Number.isFinite(point.longitude) ||
          typeof point.latitude !== "number" || !Number.isFinite(point.latitude) ||
          point.longitude < -180 || point.longitude > 180 || point.latitude < -90 || point.latitude > 90) {
        throw new Error("Invalid Mapbox details response");
      }
      const categories = Array.isArray(place.categories) ? place.categories.filter((value): value is string => typeof value === "string") : undefined;
      const photos = Array.isArray(place.photos) ? place.photos.flatMap((item) => {
        if (!item || typeof item !== "object" || typeof item.url !== "string") return [];
        return [item.url];
      }) : undefined;

      return {
        id: place.mapbox_id,
        name: place.name,
        address: typeof place.full_address === "string" ? place.full_address : "",
        coordinates: [point.longitude, point.latitude],
        categories,
        phone: typeof place.phone === "string" ? place.phone : undefined,
        website: typeof place.website === "string" ? place.website : undefined,
        photos,
        providerPlaceId: place.mapbox_id,
        openingHours: typeof place.opening_hours === "string" ? { weekdayText: [place.opening_hours] } : undefined,
      };
    } catch (err) { throw err; }
  }
}
