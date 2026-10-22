"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Activity, FriendProfile } from "@/lib/types/social";

// In-memory demo activities fallback
const demoActivities: Activity[] = [
  {
    id: "demo-act-1",
    user_id: "demo-user-1",
    type: "visit",
    cafe_id: "demo-cafe-1",
    group_id: "demo-group-1",
    visit_id: "demo-visit-1",
    metadata: { rating: 5, notes: "Best flat white in town!" },
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    profile: {
      id: "demo-user-1",
      username: "maria_cafe",
      display_name: "Maria Santos",
      avatar_url: null,
    },
    cafe: {
      id: "demo-cafe-1",
      name: "Café Antigravity",
      address: "123 Coffee St, Cavite",
    },
    group: {
      id: "demo-group-1",
      name: "Weekend Brew Crew",
    },
  },
  {
    id: "demo-act-2",
    user_id: "demo-user-2",
    type: "save",
    cafe_id: "demo-cafe-2",
    group_id: null,
    visit_id: null,
    metadata: { collection: "Must Try" },
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    profile: {
      id: "demo-user-2",
      username: "juan_brew",
      display_name: "Juan dela Cruz",
      avatar_url: null,
    },
    cafe: {
      id: "demo-cafe-2",
      name: "Solace Coffee",
      address: "Tagaytay City",
    },
  },
  {
    id: "demo-act-3",
    user_id: "demo-user-3",
    type: "photo",
    cafe_id: "demo-cafe-1",
    group_id: "demo-group-1",
    visit_id: "demo-visit-2",
    metadata: { photoUrl: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb" },
    created_at: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
    profile: {
      id: "demo-user-3",
      username: "ana_latte",
      display_name: "Ana Reyes",
      avatar_url: null,
    },
    cafe: {
      id: "demo-cafe-1",
      name: "Café Antigravity",
      address: "123 Coffee St, Cavite",
    },
    group: {
      id: "demo-group-1",
      name: "Weekend Brew Crew",
    },
  },
];

/**
 * Fetches the paginated activity feed for the current user and their friends
 */
export async function getFriendActivitiesAction(
  limit = 20,
  offset = 0
): Promise<Activity[]> {
  if (!hasSupabaseConfig()) {
    return demoActivities.slice(offset, offset + limit);
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("activities")
      .select(`
        id,
        user_id,
        type,
        cafe_id,
        group_id,
        visit_id,
        metadata,
        created_at,
        profile:profiles(id, username, display_name, avatar_url),
        cafe:cafes(id, name, address),
        group:groups(id, name)
      `)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error || !data) {
      return [];
    }

    return data as unknown as Activity[];
  } catch {
    return [];
  }
}

/**
 * Fetches the paginated activity feed for a specific group
 */
export async function getGroupActivitiesAction(
  groupId: string,
  limit = 30,
  offset = 0
): Promise<Activity[]> {
  if (!groupId) return [];

  if (!hasSupabaseConfig()) {
    return demoActivities
      .filter((a) => a.group_id === groupId || a.type === "visit")
      .slice(offset, offset + limit);
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("activities")
      .select(`
        id,
        user_id,
        type,
        cafe_id,
        group_id,
        visit_id,
        metadata,
        created_at,
        profile:profiles(id, username, display_name, avatar_url),
        cafe:cafes(id, name, address),
        group:groups(id, name)
      `)
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error || !data) {
      return [];
    }

    return data as unknown as Activity[];
  } catch {
    return [];
  }
}

/**
 * Logs a new user activity manually.
 *
 * IMPORTANT: The following activity types are ALREADY created automatically
 * by database triggers and should NOT be logged via this function:
 *   - 'visit'      → trigger: on_visit_created (fires on visits INSERT)
 *   - 'save'       → trigger: on_cafe_saved (fires on saved_cafes INSERT)
 *   - 'photo'      → trigger: on_photo_uploaded (fires on visit_photos INSERT)
 *   - 'join_group'  → trigger: on_group_joined (fires on group_members INSERT)
 *
 * Use this function ONLY for activity types not covered by triggers (e.g. 'rating')
 * or for demo mode fallback.
 */
export async function logActivityAction(
  input: Partial<Activity>
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!input.type) return { success: false, error: "Missing activity type" };

  // Guard: reject types that are already handled by DB triggers
  const triggerHandledTypes = ["visit", "save", "photo", "join_group"];
  if (hasSupabaseConfig() && triggerHandledTypes.includes(input.type)) {
    // These are auto-created by Postgres triggers. Inserting manually
    // would create duplicate activity entries in the feed.
    return { success: true, id: "trigger-handled" };
  }

  if (!hasSupabaseConfig()) {
    const newId = `demo-act-${Date.now()}`;
    const newAct: Activity = {
      id: newId,
      user_id: input.user_id || "preview-user",
      type: input.type,
      cafe_id: input.cafe_id || null,
      group_id: input.group_id || null,
      visit_id: input.visit_id || null,
      metadata: input.metadata || {},
      created_at: new Date().toISOString(),
      profile: {
        id: "preview-user",
        username: "you",
        display_name: "You",
        avatar_url: null,
      },
      cafe: input.cafe || (input.cafe_id ? { id: input.cafe_id, name: "Discovered Café" } : null),
    };
    demoActivities.unshift(newAct);
    try {
      revalidatePath("/circles");
    } catch {
      // Ignored in non-Next runtime environments
    }
    return { success: true, id: newId };
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("activities")
      .insert({
        user_id: user.id,
        type: input.type,
        cafe_id: input.cafe_id || null,
        group_id: input.group_id || null,
        visit_id: input.visit_id || null,
        metadata: input.metadata || {},
      })
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };

    try {
      revalidatePath("/circles");
    } catch {
      // Ignored in non-Next runtime environments
    }
    return { success: true, id: data.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to log activity" };
  }
}

export type GroupRelationshipStats = {
  savedCount: number;
  visitCount: number;
  averageRating: number | null;
  savedByFriends: FriendProfile[];
  visitedByFriends: FriendProfile[];
};

/**
 * Computes social stats for a café within the active Circle
 */
export async function getGroupRelationshipStatsAction(
  cafeId: string,
  groupId?: string | null
): Promise<GroupRelationshipStats> {
  const emptyStats: GroupRelationshipStats = {
    savedCount: 0,
    visitCount: 0,
    averageRating: null,
    savedByFriends: [],
    visitedByFriends: [],
  };

  if (!cafeId) {
    return emptyStats;
  }

  if (!hasSupabaseConfig()) {
    return {
      savedCount: 2,
      visitCount: 3,
      averageRating: 4.8,
      savedByFriends: [
        { id: "demo-user-1", username: "maria_cafe", display_name: "Maria Santos", avatar_url: null },
        { id: "demo-user-2", username: "juan_brew", display_name: "Juan dela Cruz", avatar_url: null },
      ],
      visitedByFriends: [
        { id: "demo-user-1", username: "maria_cafe", display_name: "Maria Santos", avatar_url: null },
        { id: "demo-user-3", username: "ana_latte", display_name: "Ana Reyes", avatar_url: null },
      ],
    };
  }

  if (!groupId) {
    return emptyStats;
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return emptyStats;
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cafeId);
    let resolvedCafeId = cafeId;

    if (!isUuid) {
      const { data: dbCafe } = await supabase
        .from("cafes")
        .select("id")
        .eq("provider_place_id", cafeId)
        .maybeSingle();

      if (!dbCafe?.id) {
        return emptyStats;
      }
      resolvedCafeId = dbCafe.id;
    }

    const [{ data: savedData }, { data: visitData }] = await Promise.all([
      supabase
        .from("group_saved_cafes")
        .select("added_by, profiles:added_by(id, username, display_name, avatar_url)")
        .eq("cafe_id", resolvedCafeId)
        .eq("group_id", groupId),
      supabase
        .from("visits")
        .select("rating, created_by, profiles:created_by(id, username, display_name, avatar_url)")
        .eq("cafe_id", resolvedCafeId)
        .eq("group_id", groupId),
    ]);

    const savedByFriendsMap = new Map<string, FriendProfile>();
    (savedData || []).forEach((s) => {
      const profile = s.profiles as unknown as FriendProfile | null;
      if (profile?.id) savedByFriendsMap.set(profile.id, profile);
    });

    const visitedByFriendsMap = new Map<string, FriendProfile>();
    let ratingSum = 0;
    let ratingCount = 0;

    (visitData || []).forEach((v) => {
      const profile = v.profiles as unknown as FriendProfile | null;
      if (profile?.id) visitedByFriendsMap.set(profile.id, profile);
      if (typeof v.rating === "number" && v.rating >= 0) {
        ratingSum += v.rating;
        ratingCount += 1;
      }
    });

    const savedByFriends = Array.from(savedByFriendsMap.values());
    const visitedByFriends = Array.from(visitedByFriendsMap.values());

    return {
      savedCount: (savedData || []).length,
      visitCount: (visitData || []).length,
      averageRating: ratingCount > 0 ? Number((ratingSum / ratingCount).toFixed(1)) : null,
      savedByFriends,
      visitedByFriends,
    };
  } catch {
    return emptyStats;
  }
}
