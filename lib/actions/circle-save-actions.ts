"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { ingestCafe, resolveCafeId } from "@/lib/data/cafe-repository";
import type { CafeReference } from "@/lib/types/circle-cafe";

type SaveRequest = { groupId: string; cafe: CafeReference };
export type CircleSaveResult = {
  success: boolean;
  error?: string;
  refreshFailed?: boolean;
};
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

async function mutateSave(
  params: SaveRequest,
  removing: boolean,
): Promise<CircleSaveResult> {
  const { groupId, cafe } = params ?? {};
  if (
    !uuid.test(groupId) ||
    !cafe ||
    !["internal", "provider"].includes(cafe.kind) ||
    typeof cafe.id !== "string" ||
    !cafe.id.trim() ||
    cafe.id.trim().length > 512 ||
    /[\x00-\x20]/.test(cafe.id.trim()) ||
    (cafe.kind === "internal" && !uuid.test(cafe.id))
  ) {
    return { success: false, error: "Invalid Circle or café reference" };
  }
  if (!hasSupabaseConfig()) {
    return { success: false, error: "Circle saves require a database connection" };
  }

  try {
    const client = await createClient();
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) {
      return { success: false, error: "Not authenticated" };
    }
    const { data: member, error: memberError } = await client
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (memberError || !member) {
      return { success: false, error: "Circle membership required" };
    }

    const cafeId = removing || cafe.kind === "internal"
      ? await resolveCafeId(cafe)
      : (await ingestCafe(cafe.id)).internalId;
    if (!cafeId) return { success: false, error: "Could not resolve café" };

    if (removing) {
      const { data, error } = await client
        .from("group_saved_cafes")
        .delete()
        .eq("group_id", groupId)
        .eq("cafe_id", cafeId)
        .eq("saved_by", auth.user.id)
        .select("id");
      if (error) return { success: false, error: error.message };
      if (!data?.length) {
        return {
          success: false,
          error: "Only the member who saved this café can remove it",
        };
      }
    } else {
      const { error } = await client.from("group_saved_cafes").insert({
        group_id: groupId,
        cafe_id: cafeId,
        saved_by: auth.user.id,
      });
      if (error) {
        if (error.code !== "23505") {
          return { success: false, error: error.message };
        }
        const { data: existing, error: readError } = await client
          .from("group_saved_cafes")
          .select("id")
          .eq("group_id", groupId)
          .eq("cafe_id", cafeId)
          .maybeSingle();
        if (readError || !existing) {
          return {
            success: false,
            error: "Could not confirm the existing Circle save",
          };
        }
      }
    }
  } catch (cause) {
    return {
      success: false,
      error: cause instanceof Error ? cause.message : "Could not update Circle save",
    };
  }

  try {
    revalidatePath(`/circles/${groupId}`);
  } catch {
    return { success: true, refreshFailed: true };
  }
  return { success: true };
}

export async function saveCafeToCircleAction(
  params: SaveRequest,
): Promise<CircleSaveResult> {
  return mutateSave(params, false);
}

export async function removeCafeFromCircleAction(
  params: SaveRequest,
): Promise<CircleSaveResult> {
  return mutateSave(params, true);
}
