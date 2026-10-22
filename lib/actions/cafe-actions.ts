"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { ingestCafe } from "@/lib/data/cafe-repository";
import type { CafeSearchResult } from "@/lib/types/places";
import type {
  CollectionSummary,
  SaveCafeParams,
  SaveCafeResult,
  SavedCafe,
} from "@/lib/types/saved-cafe";

export type UpsertCafeResult = {
  success: boolean;
  cafeId?: string;
  error?: string;
};

type SavedCafeIdRow = {
  cafe_id?: string | null;
  cafes?: { provider_place_id?: string | null } | null;
};

type SavedCafeJoinedRow = {
  id: string;
  user_id: string;
  cafe_id: string;
  collection: string;
  notes: string | null;
  created_at: string;
  cafes?: {
    id?: string | null;
    provider_place_id?: string | null;
    name?: string | null;
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
    community_rating?: number | null;
    community_rating_count?: number | null;
    price_level?: number | null;
    categories?: string[] | null;
  } | null;
};

type CollectionSummaryRow = {
  collection?: string | null;
  created_at: string;
  cafes?: { name?: string | null } | null;
};

type CafeProfileRow = {
  user_id?: string;
  profiles?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
};

// In-memory demo store for fallback preview mode when Supabase is not configured
const inMemorySavedCafes: Map<string, SavedCafe> = new Map();

/**
 * Upsert a cafe from search results into the public.cafes database table
 */
export async function upsertCafeAction(
  cafe: CafeSearchResult,
): Promise<UpsertCafeResult> {
  if (!hasSupabaseConfig()) {
    // In local demo / offline mode, return synthetic success with provider id
    return { success: true, cafeId: cafe.id };
  }

  try {
    const { internalId } = await ingestCafe(cafe?.id);

    revalidatePath("/map");
    revalidatePath("/discover");
    revalidatePath("/profile/collections");

    return { success: true, cafeId: internalId };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to upsert cafe",
    };
  }
}

/**
 * Toggle save status or update collection/notes for a cafe
 */
export async function toggleSaveCafeAction(
  params: SaveCafeParams & { isSaving?: boolean; expectedAccountId?: string },
): Promise<SaveCafeResult> {
  const rawCollection = params.collection || "Favorites";
  const cleanCollection = rawCollection.trim().slice(0, 100) || "Favorites";
  const cleanNotes = params.notes ? params.notes.trim().slice(0, 1000) : null;
  const { cafe, isSaving = true } = params;

  if (!hasSupabaseConfig()) {
    if (params.expectedAccountId && params.expectedAccountId !== "development-preview") {
      return { success: false, error: "Account changed. Please retry." };
    }
    // Demo fallback mode
    const key = `preview-user:${cafe.id}:${cleanCollection}`;
    if (isSaving) {
      const savedItem: SavedCafe = {
        id: `mock-save-${Date.now()}`,
        user_id: "preview-user",
        cafe_id: cafe.id,
        collection: cleanCollection,
        notes: cleanNotes,
        created_at: new Date().toISOString(),
        cafe,
      };
      inMemorySavedCafes.set(key, savedItem);
      return { success: true, isSaved: true, savedId: savedItem.id };
    } else {
      inMemorySavedCafes.delete(key);
      return { success: true, isSaved: false };
    }
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "You must be signed in to save cafés." };
    }
    if (params.expectedAccountId && user.id !== params.expectedAccountId) {
      return { success: false, error: "Account changed. Please retry." };
    }

    // 1. Ensure café exists in the DB
    const upsertRes = await upsertCafeAction(cafe);
    if (!upsertRes.success || !upsertRes.cafeId) {
      return { success: false, error: upsertRes.error || "Failed to locate café record." };
    }

    const internalCafeId = upsertRes.cafeId;

    if (!isSaving) {
      // Unsave
      const { error: deleteError } = await supabase
        .from("saved_cafes")
        .delete()
        .eq("user_id", user.id)
        .eq("cafe_id", internalCafeId)
        .eq("collection", cleanCollection);

      if (deleteError) {
        return { success: false, error: deleteError.message };
      }

      try {
        revalidatePath("/profile");
        revalidatePath("/profile/collections");
        revalidatePath(`/profile/collections/${encodeURIComponent(cleanCollection)}`);
      } catch {
        return { success: true, isSaved: false, refreshFailed: true };
      }
      return { success: true, isSaved: false };
    }

    // Save
    const { data: savedData, error: saveError } = await supabase
      .from("saved_cafes")
      .upsert(
        {
          user_id: user.id,
          cafe_id: internalCafeId,
          collection: cleanCollection,
          notes: cleanNotes,
        },
        { onConflict: "user_id,cafe_id,collection" },
      )
      .select("id")
      .single();

    if (saveError) {
      return { success: false, error: saveError.message };
    }

    try {
      revalidatePath("/profile");
      revalidatePath("/profile/collections");
      revalidatePath(`/profile/collections/${encodeURIComponent(cleanCollection)}`);
    } catch {
      return { success: true, isSaved: true, savedId: savedData?.id, refreshFailed: true };
    }

    return {
      success: true,
      isSaved: true,
      savedId: savedData?.id,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to toggle save status",
    };
  }
}

/**
 * Check if a cafe is currently saved by the active user
 */
export async function isCafeSavedAction(
  cafeIdOrProviderId: string,
  collection?: string,
): Promise<{ isSaved: boolean; collections: string[] }> {
  if (!cafeIdOrProviderId) {
    return { isSaved: false, collections: [] };
  }

  if (!hasSupabaseConfig()) {
    const matching: string[] = [];
    inMemorySavedCafes.forEach((val) => {
      if (val.cafe_id === cafeIdOrProviderId) {
        matching.push(val.collection);
      }
    });
    const isSaved = collection
      ? matching.includes(collection)
      : matching.length > 0;
    return { isSaved, collections: matching };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { isSaved: false, collections: [] };
    }

    // Safe UUID check vs Provider ID query to prevent string injection
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        cafeIdOrProviderId,
      );

    let internalCafeId: string | null = null;

    if (isUuid) {
      const { data: directMatch } = await supabase
        .from("cafes")
        .select("id")
        .eq("id", cafeIdOrProviderId)
        .maybeSingle();
      if (directMatch?.id) {
        internalCafeId = directMatch.id;
      }
    }

    if (!internalCafeId) {
      const { data: providerMatch } = await supabase
        .from("cafes")
        .select("id")
        .eq("provider_place_id", cafeIdOrProviderId)
        .maybeSingle();
      if (providerMatch?.id) {
        internalCafeId = providerMatch.id;
      }
    }

    if (!internalCafeId) {
      return { isSaved: false, collections: [] };
    }

    let query = supabase
      .from("saved_cafes")
      .select("collection")
      .eq("user_id", user.id)
      .eq("cafe_id", internalCafeId);

    if (collection) {
      query = query.eq("collection", collection);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      return { isSaved: false, collections: [] };
    }

    const collections = data.map((d) => d.collection);
    return { isSaved: true, collections };
  } catch {
    return { isSaved: false, collections: [] };
  }
}

/**
 * Get all saved café and provider IDs for fast batch checking on list views
 */
export async function getUserSavedCafeIdsAction(): Promise<string[]> {
  if (!hasSupabaseConfig()) {
    const ids = new Set<string>();
    inMemorySavedCafes.forEach((val) => {
      ids.add(val.cafe_id);
    });
    return Array.from(ids);
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return [];

    const { data, error } = await supabase
      .from("saved_cafes")
      .select("cafe_id, cafes:cafe_id ( provider_place_id )")
      .eq("user_id", user.id);

    if (error || !data) return [];

    const ids = new Set<string>();
    (data as unknown as SavedCafeIdRow[]).forEach((row) => {
      if (row.cafe_id) ids.add(row.cafe_id);
      if (row.cafes?.provider_place_id) ids.add(row.cafes.provider_place_id);
    });

    return Array.from(ids);
  } catch {
    return [];
  }
}

/**
 * Get all saved cafes for the user, optionally filtered by collection
 */
export async function getSavedCafesAction(
  collection?: string,
): Promise<SavedCafe[]> {
  if (!hasSupabaseConfig()) {
    const results: SavedCafe[] = [];
    inMemorySavedCafes.forEach((val) => {
      if (!collection || val.collection.toLowerCase() === collection.toLowerCase()) {
        results.push(val);
      }
    });
    return results.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }

  const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) throw new Error("Not authenticated");

    let query = supabase
      .from("saved_cafes")
      .select(`
        id,
        user_id,
        cafe_id,
        collection,
        notes,
        created_at,
        cafes:cafe_id (
          id,
          provider_place_id,
          name,
          address,
          lat,
          lng,
          price_level,
          categories
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (collection) {
      query = query.eq("collection", collection);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Could not load saved cafés");

    return (data as unknown as SavedCafeJoinedRow[]).map((item) => {
      const c = item.cafes;
      let categories: string[] = [];
      if (c?.categories) {
        categories = Array.isArray(c.categories) ? c.categories : [];
      }

      const cafe: CafeSearchResult = {
        id: c?.provider_place_id || c?.id || item.cafe_id,
        internalId: c?.id ?? item.cafe_id,
        name: c?.name || "Specialty Café",
        address: c?.address || "Philippines",
        coordinates: [c?.lng ?? 120.9367, c?.lat ?? 14.4172],
        priceLevel: c?.price_level ?? undefined,
        categories,
      };

      return {
        id: item.id,
        user_id: item.user_id,
        cafe_id: item.cafe_id,
        collection: item.collection,
        notes: item.notes,
        created_at: item.created_at,
        cafe,
      };
    });
}

/**
 * Get distinct collections for user with cafe count and summary
 */
export async function getUserCollectionsAction(): Promise<CollectionSummary[]> {
  if (!hasSupabaseConfig()) {
    const summaryMap = new Map<string, { count: number; lastSavedAt: string; samples: string[] }>();
    inMemorySavedCafes.forEach((val) => {
      const existing = summaryMap.get(val.collection) || {
        count: 0,
        lastSavedAt: val.created_at,
        samples: [],
      };
      existing.count += 1;
      if (val.cafe?.name && existing.samples.length < 3) {
        existing.samples.push(val.cafe.name);
      }
      summaryMap.set(val.collection, existing);
    });

    if (summaryMap.size === 0) {
      // Default empty collection for preview
      return [
        {
          name: "Favorites",
          count: 0,
          lastSavedAt: new Date().toISOString(),
          sampleCafes: [],
        },
      ];
    }

    return Array.from(summaryMap.entries()).map(([name, val]) => ({
      name,
      count: val.count,
      lastSavedAt: val.lastSavedAt,
      sampleCafes: val.samples,
    }));
  }

  const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("saved_cafes")
      .select(`
        collection,
        created_at,
        cafes:cafe_id ( name )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    if (!data) throw new Error("Could not load collections");

    type CollectionMapEntry = {
      count: number;
      lastSavedAt: string;
      samples: string[];
    };

    const summaryMap = new Map<string, CollectionMapEntry>();

    (data as unknown as CollectionSummaryRow[]).forEach((row) => {
      const colName = row.collection || "Favorites";
      const existing: CollectionMapEntry = summaryMap.get(colName) || {
        count: 0,
        lastSavedAt: row.created_at,
        samples: [],
      };
      existing.count += 1;
      const cafeName = typeof row.cafes?.name === "string" ? row.cafes.name : "";
      if (cafeName && existing.samples.length < 3 && !existing.samples.includes(cafeName)) {
        existing.samples.push(cafeName);
      }
      summaryMap.set(colName, existing);
    });

    // If user has no collections yet, provide a ready "Favorites" collection
    if (summaryMap.size === 0) {
      return [
        {
          name: "Favorites",
          count: 0,
          lastSavedAt: new Date().toISOString(),
          sampleCafes: [],
        },
      ];
    }

    return Array.from(summaryMap.entries()).map(([name, val]) => ({
      name,
      count: val.count,
      lastSavedAt: val.lastSavedAt,
      sampleCafes: val.samples,
    }));
}

/**
 * Delete a collection and all its saves
 */
export async function deleteCollectionAction(
  collectionName: string,
): Promise<{ success: boolean; error?: string }> {
  if (!hasSupabaseConfig()) {
    Array.from(inMemorySavedCafes.entries()).forEach(([key, val]) => {
      if (val.collection === collectionName) {
        inMemorySavedCafes.delete(key);
      }
    });
    return { success: true };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const { error } = await supabase
      .from("saved_cafes")
      .delete()
      .eq("user_id", user.id)
      .eq("collection", collectionName);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/profile");
    revalidatePath("/profile/collections");
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete collection",
    };
  }
}

/**
 * Get friend profiles who saved a specific cafe
 */
export async function getFriendsWhoSavedCafeAction(
  cafeIdOrProviderId: string,
): Promise<{ id: string; username: string; display_name: string; avatar_url: string | null }[]> {
  if (!cafeIdOrProviderId) return [];

  if (!hasSupabaseConfig()) {
    // Demo mode fallback: return empty
    return [];
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Resolve internal cafe ID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cafeIdOrProviderId);
    let internalCafeId: string | null = null;

    if (isUuid) {
      const { data } = await supabase.from("cafes").select("id").eq("id", cafeIdOrProviderId).maybeSingle();
      if (data?.id) internalCafeId = data.id;
    }
    if (!internalCafeId) {
      const { data } = await supabase.from("cafes").select("id").eq("provider_place_id", cafeIdOrProviderId).maybeSingle();
      if (data?.id) internalCafeId = data.id;
    }
    if (!internalCafeId) return [];

    // Query saved_cafes joined with profiles, filtered by friendship (RLS handles visibility)
    const { data: saves, error } = await supabase
      .from("saved_cafes")
      .select("user_id, profiles:user_id ( id, username, display_name, avatar_url )")
      .eq("cafe_id", internalCafeId)
      .neq("user_id", user.id);

    if (error || !saves) return [];

    // Deduplicate by user_id
    const seen = new Set<string>();
    const results: { id: string; username: string; display_name: string; avatar_url: string | null }[] = [];
    for (const row of saves as unknown as CafeProfileRow[]) {
      const p = row.profiles;
      if (p && !seen.has(p.id)) {
        seen.add(p.id);
        results.push({ id: p.id, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url });
      }
    }
    return results;
  } catch {
    return [];
  }
}

/**
 * Toggle "I'm Interested" status for a cafe within a specific group
 */
export async function toggleInterestAction(
  cafe: CafeSearchResult,
  groupId: string,
  isInterested: boolean
): Promise<{ success: boolean; error?: string }> {
  if (!hasSupabaseConfig()) {
    // In-memory demo mode not fully implemented for interests yet
    return { success: true };
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const upsertRes = await upsertCafeAction(cafe);
    if (!upsertRes.success || !upsertRes.cafeId) {
      return { success: false, error: "Failed to locate café record." };
    }

    const internalCafeId = upsertRes.cafeId;

    if (!isInterested) {
      const { error } = await supabase
        .from("cafe_interests")
        .delete()
        .eq("user_id", user.id)
        .eq("cafe_id", internalCafeId)
        .eq("group_id", groupId);
      
      if (error) return { success: false, error: error.message };
    } else {
      const { error } = await supabase
        .from("cafe_interests")
        .insert({
          user_id: user.id,
          cafe_id: internalCafeId,
          group_id: groupId
        });
        
      if (error && error.code !== '23505') { // Ignore unique constraint violations
        return { success: false, error: error.message };
      }
    }

    revalidatePath("/map");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to toggle interest" };
  }
}

/**
 * Get all members who are interested in a cafe within a specific group
 */
export async function getCafeInterestsAction(
  cafeIdOrProviderId: string,
  groupId: string
): Promise<{ id: string; username: string; display_name: string; avatar_url: string | null }[]> {
  if (!cafeIdOrProviderId || !groupId) return [];

  if (!hasSupabaseConfig()) {
    return [];
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cafeIdOrProviderId);
    let internalCafeId: string | null = null;

    if (isUuid) {
      const { data } = await supabase.from("cafes").select("id").eq("id", cafeIdOrProviderId).maybeSingle();
      if (data?.id) internalCafeId = data.id;
    }
    if (!internalCafeId) {
      const { data } = await supabase.from("cafes").select("id").eq("provider_place_id", cafeIdOrProviderId).maybeSingle();
      if (data?.id) internalCafeId = data.id;
    }
    if (!internalCafeId) return [];

    const { data: interests, error } = await supabase
      .from("cafe_interests")
      .select("user_id, profiles:user_id ( id, username, display_name, avatar_url )")
      .eq("cafe_id", internalCafeId)
      .eq("group_id", groupId);

    if (error || !interests) return [];

    const results: { id: string; username: string; display_name: string; avatar_url: string | null }[] = [];
    for (const row of interests as unknown as CafeProfileRow[]) {
      const p = row.profiles;
      if (p) {
        results.push({ id: p.id, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url });
      }
    }
    return results;
  } catch {
    return [];
  }
}

/**
 * Check if the current user is interested in a cafe within a specific group
 */
export async function isCafeInterestedAction(
  cafeIdOrProviderId: string,
  groupId: string
): Promise<boolean> {
  if (!cafeIdOrProviderId || !groupId) return false;
  if (!hasSupabaseConfig()) return false;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cafeIdOrProviderId);
    let internalCafeId: string | null = null;

    if (isUuid) {
      const { data } = await supabase.from("cafes").select("id").eq("id", cafeIdOrProviderId).maybeSingle();
      if (data?.id) internalCafeId = data.id;
    }
    if (!internalCafeId) {
      const { data } = await supabase.from("cafes").select("id").eq("provider_place_id", cafeIdOrProviderId).maybeSingle();
      if (data?.id) internalCafeId = data.id;
    }
    if (!internalCafeId) return false;

    const { data, error } = await supabase
      .from("cafe_interests")
      .select("id")
      .eq("user_id", user.id)
      .eq("cafe_id", internalCafeId)
      .eq("group_id", groupId)
      .maybeSingle();

    if (error || !data) return false;
    return true;
  } catch {
    return false;
  }
}
