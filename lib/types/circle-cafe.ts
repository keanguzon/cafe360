import type { FriendProfile } from "./social";

export type CafeReference = { kind: "internal" | "provider"; id: string };

export type CircleCafeSummary = {
  internalId: string;
  providerId: string;
  name: string;
  coordinates: [number, number];
  interestedMembers: FriendProfile[];
  visitCount: number;
  photoCount: number;
  rating: number | null;
  ratingCount: number;
};
