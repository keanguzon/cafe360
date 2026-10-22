import type { CafeSearchResult } from "./places";

export type SavedCafe = {
  id: string;
  user_id: string;
  cafe_id: string;
  collection: string;
  notes: string | null;
  created_at: string;
  cafe?: CafeSearchResult;
};

export type CollectionSummary = {
  name: string;
  count: number;
  lastSavedAt: string;
  coverPhotoUrl?: string;
  sampleCafes: string[];
};

export type SaveCafeParams = {
  cafe: CafeSearchResult;
  collection?: string;
  notes?: string;
};

export type SaveCafeResult = {
  success: boolean;
  refreshFailed?: boolean;
  savedId?: string;
  isSaved?: boolean;
  error?: string;
};
