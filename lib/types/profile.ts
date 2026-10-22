export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileStats = {
  visitsCount: number;
  favoritesCount: number;
  memoriesCount: number;
  groupsCount: number;
};
