"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { upsertCafeAction } from "./cafe-actions";
import type { CafeSearchResult } from "@/lib/types/places";
import type { CafeHoursEntry } from "@/lib/utils/cafe-hours";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const time = /^([01]\d|2[0-3]):[0-5]\d$/;
type HoursInput = { day_of_week: number; open_time: string; close_time: string; is_closed: boolean };

function validateHours(hours: HoursInput[]): string | null {
  if (!Array.isArray(hours) || hours.length !== 7) return "Hours must cover seven days";
  const days = new Set<number>();
  for (const item of hours) {
    if (!Number.isInteger(item?.day_of_week) || item.day_of_week < 0 || item.day_of_week > 6) return "Invalid day";
    if (days.has(item.day_of_week)) return "Hours require unique days";
    days.add(item.day_of_week);
    if (typeof item.is_closed !== "boolean") return "Invalid closed state";
    if (!item.is_closed && (!time.test(item.open_time) || !time.test(item.close_time) ||
        item.open_time === item.close_time)) return "Invalid time";
  }
  return null;
}

/**
 * Fetch hours for a cafe within a specific circle
 */
export async function getCircleCafeHoursAction(
  groupId: string,
  cafeIdOrProviderId: string,
): Promise<CafeHoursEntry[]> {
  if (!uuid.test(groupId) || !cafeIdOrProviderId?.trim()) throw new Error("Invalid hours request");
  if (!hasSupabaseConfig()) throw new Error("Café hours require a database connection");

  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) throw new Error("Unauthorized");

    // Resolve internal cafe ID
    const isUuid = uuid.test(cafeIdOrProviderId);
    let internalCafeId = cafeIdOrProviderId;

    if (!isUuid) {
      const { data, error } = await supabase
        .from("cafes")
        .select("id")
        .eq("provider_place_id", cafeIdOrProviderId)
        .maybeSingle();
      if (error) throw error;
      if (!data?.id) return [];
      internalCafeId = data.id;
    }

    const { data, error } = await supabase
      .from("circle_cafe_hours")
      .select("id, day_of_week, open_time, close_time, is_closed, timezone")
      .eq("group_id", groupId)
      .eq("cafe_id", internalCafeId)
      .order("day_of_week");

    if (error) throw error;
    return data ?? [];
  } catch (error) {
    throw error instanceof Error ? error : new Error("Failed to load café hours");
  }
}

/**
 * Save hours for a cafe within a circle (upserts all 7 days)
 */
export async function saveCircleCafeHoursAction(
  groupId: string,
  cafe: CafeSearchResult,
  hours: HoursInput[],
): Promise<{ success: boolean; error?: string }> {
  if (!uuid.test(groupId) || !cafe?.id) return { success: false, error: "Missing or invalid required fields" };
  const validation = validateHours(hours);
  if (validation) return { success: false, error: validation };
  if (!hasSupabaseConfig()) return { success: false, error: "Café hours require a database connection" };

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { success: false, error: "Unauthorized" };
    const { data: member, error: memberError } = await supabase
      .from("group_members").select("user_id")
      .eq("group_id", groupId).eq("user_id", user.id).maybeSingle();
    if (memberError || !member) return { success: false, error: "Circle membership required" };

    // Ensure cafe exists in DB
    const upsertRes = await upsertCafeAction(cafe);
    if (!upsertRes.success || !upsertRes.cafeId) {
      return { success: false, error: upsertRes.error || "Failed to resolve café" };
    }
    const { data: record, error: recordError } = await supabase
      .from("cafes").select("timezone").eq("id", upsertRes.cafeId).maybeSingle();
    if (recordError) return { success: false, error: recordError.message };
    let timezone = record?.timezone || "Asia/Manila";
    try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }); }
    catch { timezone = "Asia/Manila"; }

    const rows = hours.map((h) => ({
      group_id: groupId,
      cafe_id: upsertRes.cafeId!,
      day_of_week: h.day_of_week,
      open_time: h.is_closed ? null : h.open_time,
      close_time: h.is_closed ? null : h.close_time,
      is_closed: h.is_closed,
      timezone,
      submitted_by: user.id,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("circle_cafe_hours")
      .upsert(rows, { onConflict: "group_id,cafe_id,day_of_week" });

    if (error) return { success: false, error: error.message };

    try { revalidatePath("/map"); } catch {
      // The hours have committed; a failed cache refresh must not invite duplicate writes.
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to save hours" };
  }
}
