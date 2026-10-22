"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { parseLocalDate } from "@/lib/utils/visit-date";
import { upsertCafeAction } from "./cafe-actions";
import type { CreateVisitInput, VisitWithDetails } from "@/lib/types/visit";

export type CreateVisitResult = {
  success: boolean;
  visitId?: string;
  error?: string;
};

const inMemoryVisits: Map<string, VisitWithDetails> = new Map();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateVisit(input: CreateVisitInput): string | null {
  if (!input || typeof input !== "object") return "Invalid visit";
  if (!uuid.test(input.group_id)) return "Invalid Circle";
  if (!input.cafe_id?.trim()) return "Invalid café";
  try { parseLocalDate(input.visited_at); } catch { return "Invalid visit date"; }
  if (input.rating != null &&
      (!Number.isFinite(input.rating) || input.rating < 0 || input.rating > 5 ||
       Math.round(input.rating * 10) !== input.rating * 10)) return "Invalid rating";
  if (input.notes != null && (typeof input.notes !== "string" || input.notes.length > 1000)) return "Invalid notes";
  const participants = input.participant_ids ?? [];
  if (!Array.isArray(participants) || participants.length > 5 ||
      participants.some((id) => typeof id !== "string" || !uuid.test(id)) ||
      new Set(participants).size !== participants.length) return "Invalid participants";
  const photos = input.photo_paths ?? [];
  if (!Array.isArray(photos) || photos.length > 5 ||
      photos.some((path) => typeof path !== "string" || !path.trim()) ||
      new Set(photos).size !== photos.length) return "Invalid photos";
  return null;
}

export async function createVisitAction(input: CreateVisitInput): Promise<CreateVisitResult> {
  const validationError = validateVisit(input);
  if (validationError) return { success: false, error: validationError };

  try {
    if (!hasSupabaseConfig()) {
      return { success: false, error: "Visit logging requires a database connection." };
    }
    const supabase = await createClient();
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData.user) return { success: false, error: "Unauthorized" };

    // Check membership before any provider lookup or ingestion.
    const { data: membership, error: membershipError } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", input.group_id)
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (membershipError || !membership) return { success: false, error: "Circle membership required" };

    let cafeId = input.cafe_id;
    if (!uuid.test(cafeId)) {
      if (input.cafe) {
        if (input.cafe.id !== cafeId) return { success: false, error: "Café selection mismatch" };
        const upsert = await upsertCafeAction(input.cafe);
        if (!upsert.success || !upsert.cafeId) {
          return { success: false, error: upsert.error || "Failed to resolve café record" };
        }
        cafeId = upsert.cafeId;
      } else {
        const { data: dbCafe, error: cafeError } = await supabase
          .from("cafes").select("id").eq("provider_place_id", cafeId).maybeSingle();
        if (cafeError || !dbCafe) return { success: false, error: "Café not found. Please select it again." };
        cafeId = dbCafe.id;
      }
    }
    if (!uuid.test(cafeId)) return { success: false, error: "Invalid café record" };

    const { data, error } = await supabase.rpc("create_circle_visit", { p_input: {
      groupId: input.group_id,
      cafeId,
      visitedAt: input.visited_at,
      rating: input.rating ?? null,
      notes: input.notes ?? null,
      participants: input.participant_ids ?? [],
      photos: (input.photo_paths ?? []).map((storagePath) => ({ storagePath })),
    } });
    if (error || !data?.visitId) return { success: false, error: error?.message || "Failed to create visit" };

    try {
      revalidatePath(`/cafe/${input.cafe_id}`);
      revalidatePath("/profile");
    } catch {
      // The visit has committed; client Circle invalidation still runs.
    }
    return { success: true, visitId: data.visitId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create visit" };
  }
}

/**
 * Gets visits for a specific cafe (visible to user based on RLS)
 */
export async function getVisitsForCafeAction(
  cafeId: string,
  groupId: string
): Promise<VisitWithDetails[]> {
  if (!hasSupabaseConfig()) {
    // In local demo / offline mode, return synthetic visits
    const visits = Array.from(inMemoryVisits.values()).filter(v => v.cafe_id === cafeId && v.group_id === groupId);
    return visits.sort((a, b) => new Date(b.visited_at).getTime() - new Date(a.visited_at).getTime());
  }

  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) throw new Error("Unauthorized");

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cafeId);
    let resolvedCafeId = cafeId;

    if (!isUuid) {
      // Look up cafe by provider_place_id if not a direct UUID
      const { data: dbCafe, error: cafeError } = await supabase
        .from("cafes")
        .select("id")
        .eq("provider_place_id", cafeId)
        .maybeSingle();
      if (cafeError) throw new Error(cafeError.message);

      if (!dbCafe) {
        return [];
      }
      resolvedCafeId = dbCafe.id;
    }
    
    // RLS will ensure we only see visits we are allowed to see
    const { data, error } = await supabase
      .from("visits")
      .select(`
        *,
        creator:profiles!created_by(*),
        participants:visit_participants(
          user:profiles(*)
        ),
        photos:visit_photos(*)
      `)
      .eq("cafe_id", resolvedCafeId)
      .eq("group_id", groupId)
      .order("visited_at", { ascending: false });

    if (error) throw new Error(error.message);

    return data || [];
  } catch (err) {
    throw err instanceof Error ? err : new Error("Failed to load visits");
  }
}

/**
 * Gets visits for the current logged-in user
 */
export async function getUserVisitsAction(): Promise<VisitWithDetails[]> {
  if (!hasSupabaseConfig()) {
    // In local demo / offline mode, return synthetic visits
    const visits = Array.from(inMemoryVisits.values()).filter(v => v.created_by === "demo-user-id");
    return visits.sort((a, b) => new Date(b.visited_at).getTime() - new Date(a.visited_at).getTime());
  }

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    
    if (!userData.user) return [];

    const { data, error } = await supabase
      .from("visits")
      .select(`
        *,
        cafe:cafes(*),
        creator:profiles!created_by(*),
        participants:visit_participants(
          user:profiles(*)
        ),
        photos:visit_photos(*)
      `)
      .eq("created_by", userData.user.id)
      .order("visited_at", { ascending: false });

    if (error) {
      console.error("Get user visits error:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Get user visits action error:", err);
    return [];
  }
}

/**
 * Gets visits for a specific circle / group
 */
export async function getCircleVisitsAction(groupId: string): Promise<VisitWithDetails[]> {
  if (!hasSupabaseConfig()) {
    return Array.from(inMemoryVisits.values()).filter((v) => v.group_id === groupId);
  }

  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) throw new Error("Unauthorized");

    const { data, error } = await supabase
      .from("visits")
      .select(`
        *,
        cafe:cafes(*),
        creator:profiles!created_by(*),
        participants:visit_participants(
          user:profiles(*)
        ),
        photos:visit_photos(*)
      `)
      .eq("group_id", groupId)
      .order("visited_at", { ascending: false });

    if (error) throw new Error(error.message);

    return data || [];
  } catch (err) {
    throw err instanceof Error ? err : new Error("Failed to load Circle visits");
  }
}
