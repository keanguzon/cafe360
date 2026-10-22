"use server";

import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { CircleCafeSummary } from "@/lib/types/circle-cafe";
import type { FriendProfile } from "@/lib/types/social";

type SummaryRow = {
  cafe_id: string;
  provider_place_id: string;
  name: string;
  lat: number;
  lng: number;
  interested_members: string[];
  visit_count: number;
  photo_count: number;
  rating: number | null;
  rating_count: number;
};

export async function getCircleCafeSummariesAction(groupId: string): Promise<CircleCafeSummary[]> {
  if (!hasSupabaseConfig()) return [];
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");
  const { data, error } = await supabase.rpc("circle_cafe_summaries", { p_group_id: groupId });
  if (error) throw new Error(error.message);
  const rows = (data || []) as SummaryRow[];
  const memberIds = [...new Set(rows.flatMap((row) => row.interested_members || []))];
  const members = new Map<string, FriendProfile>();
  if (memberIds.length) {
    const { data: profiles, error: profileError } = await supabase.from("profiles")
      .select("id, username, display_name, avatar_url").in("id", memberIds);
    if (profileError) throw new Error(profileError.message);
    for (const profile of (profiles || []) as FriendProfile[]) members.set(profile.id, profile);
  }
  return rows.map((row) => ({
    internalId: row.cafe_id,
    providerId: row.provider_place_id,
    name: row.name,
    coordinates: [row.lng, row.lat],
    interestedMembers: (row.interested_members || []).flatMap((id) => {
      const member = members.get(id);
      return member ? [member] : [];
    }),
    visitCount: Number(row.visit_count),
    photoCount: Number(row.photo_count),
    rating: row.rating === null ? null : Number(row.rating),
    ratingCount: Number(row.rating_count),
  }));
}
