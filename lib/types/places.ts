export type CoordinateTuple = [number, number]; // [lng, lat]

export type CafeSearchResult = {
  id: string;
  internalId?: string;
  name: string;
  address: string;
  coordinates: CoordinateTuple;
  distanceMeters?: number;
  categories?: string[];
  rating?: number;
  ratingCount?: number;
  priceLevel?: number; // 1 to 4 ($ to $$$$)
  openNow?: boolean;
  photoUrl?: string;
};

export type CafeOpeningHours = {
  openNow?: boolean;
  weekdayText?: string[];
  periods?: Array<{
    open: { day: number; time: string };
    close?: { day: number; time: string };
  }>;
};

export type CafeDetails = {
  id: string;
  name: string;
  address: string;
  coordinates: CoordinateTuple;
  phone?: string;
  website?: string;
  openingHours?: CafeOpeningHours;
  categories?: string[];
  photos?: string[];
  rating?: number;
  ratingCount?: number;
  priceLevel?: number;
  providerPlaceId?: string;
};

export type SearchParams = {
  query?: string;
  coordinates?: CoordinateTuple;
  radiusMeters?: number;
  limit?: number;
  categories?: string[];
  openNow?: boolean;
};

export type SearchResponse = {
  results: CafeSearchResult[];
  total: number;
  attribution?: string;
};
