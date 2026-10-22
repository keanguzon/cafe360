import type { Profile } from "./profile";

// Lightweight profile for friend lists (no bio/timestamps)
export type FriendProfile = Pick<Profile, "id" | "username" | "display_name" | "avatar_url">;

export type FriendshipStatus = "pending" | "accepted" | "declined" | "blocked";

export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
};

// A pending request with the requester's profile attached
export type FriendRequest = {
  friendship: Friendship;
  profile: FriendProfile; // the other user's profile
};

export type GroupRole = "owner" | "admin" | "member";

export type Group = {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  created_by: string | null;
  invite_code: string;
  created_at: string;
  updated_at: string;
};

export type GroupMember = {
  group_id: string;
  user_id: string;
  role: GroupRole;
  joined_at: string;
  profile?: FriendProfile; // joined from profiles table
};

export type GroupWithMembers = Group & {
  members: GroupMember[];
  member_count: number;
};

export type CircleMemberInfo = {
  userId: string;
  role: GroupRole;
  displayName: string;
  avatarUrl: string | null;
};

export type GroupSavedCafe = {
  id: string;
  group_id: string;
  cafe_id: string;
  saved_by: string | null;
  created_at: string;
  cafe_name?: string;
  cafe_address?: string;
};

export type ActivityType = "visit" | "save" | "photo" | "rating" | "interest" | "join_group";

export type Activity = {
  id: string;
  user_id: string;
  type: ActivityType;
  cafe_id: string | null;
  group_id: string | null;
  visit_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  profile?: FriendProfile;
  cafe?: {
    id: string;
    name: string;
    address?: string | null;
  } | null;
  group?: {
    id: string;
    name: string;
  } | null;
};
export type CircleSummary = {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  invite_code: string;
  member_count: number;
  role: GroupRole;
  preview_avatars: (string | null)[];
};

export type CircleDetails = GroupWithMembers & {
  saved_cafes: GroupSavedCafe[];
  recent_visits_count: number;
};
