import { CafeSearchResult as Cafe } from './places';
import { FriendProfile } from './social';

export interface Visit {
  id: string;
  group_id: string;
  cafe_id: string;
  created_by: string;
  visited_at: string;
  rating: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface VisitParticipant {
  visit_id: string;
  user_id: string;
}

export interface VisitPhoto {
  id: string;
  visit_id: string;
  uploaded_by: string;
  storage_path: string;
  caption: string | null;
  created_at: string;
}

export interface VisitWithDetails extends Visit {
  cafe?: Cafe;
  creator?: FriendProfile;
  participants?: { user: FriendProfile }[];
  photos?: VisitPhoto[];
}

export interface CreateVisitInput {
  cafe_id: string;
  group_id: string;
  visited_at: string;
  rating?: number | null;
  notes?: string | null;
  participant_ids?: string[];
  photo_paths?: string[]; // paths uploaded to storage
  cafe?: Cafe;
}

