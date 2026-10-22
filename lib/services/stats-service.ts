import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type PersonalStats = {
  visits: number;
  saved: number;
  photos: number;
  groups: number;
  topRatedCafe?: { name: string; rating: number } | null;
};

export type GroupStats = {
  totalVisits: number;
  totalSaves: number;
  memberCount: number;
  topCafeName?: string | null;
};

/**
 * Fetches aggregated statistics for the current user
 */
export async function getPersonalStats(): Promise<PersonalStats> {
  if (!hasSupabaseConfig()) {
    return {
      visits: 8,
      saved: 14,
      photos: 19,
      groups: 2,
      topRatedCafe: { name: "Café Antigravity", rating: 5 },
    };
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { visits: 0, saved: 0, photos: 0, groups: 0, topRatedCafe: null };
    }

    const [visitsRes, savedRes, photosRes, groupsRes] = await Promise.all([
      supabase.from("visits").select("*", { count: "exact", head: true }).eq("created_by", user.id),
      supabase.from("saved_cafes").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("visit_photos").select("*", { count: "exact", head: true }).eq("uploaded_by", user.id),
      supabase.from("group_members").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    ]);

    return {
      visits: visitsRes.count || 0,
      saved: savedRes.count || 0,
      photos: photosRes.count || 0,
      groups: groupsRes.count || 0,
      topRatedCafe: null,
    };
  } catch {
    return { visits: 0, saved: 0, photos: 0, groups: 0, topRatedCafe: null };
  }
}

/**
 * Fetches aggregated statistics for a specific group
 */
export async function getGroupStats(groupId: string): Promise<GroupStats> {
  if (!groupId) {
    return { totalVisits: 0, totalSaves: 0, memberCount: 0 };
  }

  if (!hasSupabaseConfig()) {
    return {
      totalVisits: 12,
      totalSaves: 7,
      memberCount: 4,
      topCafeName: "Café Antigravity",
    };
  }

  try {
    const supabase = await createClient();

    // 1. Get group member IDs first
    const { data: members } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupId);

    const memberIds = (members || []).map((m) => m.user_id);
    const memberCount = memberIds.length;

    if (memberCount === 0) {
      return { totalVisits: 0, totalSaves: 0, memberCount: 0 };
    }

    // 2. Count group saves and group visits in parallel
    const [savesRes, visitsRes] = await Promise.all([
      supabase
        .from("group_saved_cafes")
        .select("*", { count: "exact", head: true })
        .eq("group_id", groupId),
      supabase
        .from("visits")
        .select("*", { count: "exact", head: true })
        .eq("group_id", groupId),
    ]);

    return {
      totalVisits: visitsRes.count || 0,
      totalSaves: savesRes.count || 0,
      memberCount,
    };
  } catch {
    return { totalVisits: 0, totalSaves: 0, memberCount: 0 };
  }
}
