import type { CafeDetails, SearchParams, SearchResponse } from "@/lib/types/places";

export interface PlacesProvider {
  readonly name: string;
  searchNearby(params: SearchParams): Promise<SearchResponse>;
  searchText(params: SearchParams): Promise<SearchResponse>;
  getDetails(id: string): Promise<CafeDetails | null>;
}
