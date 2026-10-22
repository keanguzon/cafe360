"use server";

import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getGroupActivitiesAction } from "./activity-actions";
import type { Activity } from "@/lib/types/social";
import type { ActivityCursor, ActivityPageResult } from "@/lib/types/activity-page";

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

export async function getCircleActivityPageAction(groupId: string, cursor: ActivityCursor | null = null): Promise<ActivityPageResult> {
  try {
    const configured = hasSupabaseConfig();
    if (typeof groupId !== "string" || !groupId || (configured && !UUID.test(groupId)) ||
      (cursor && (!UUID.test(cursor.id) || !TIMESTAMP.test(cursor.createdAt) || !Number.isFinite(Date.parse(cursor.createdAt))))) {
      return { ok: false, status: 400, error: "Invalid activity request" };
    }
    if (!configured) {
      const items = (await getGroupActivitiesAction(groupId, 20)).filter((item) => item.group_id === groupId);
      return { ok: true, data: { items, nextCursor: null } };
    }
    const client = await createClient();
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth?.user) return { ok: false, status: 401, error: "Session expired. Sign in again." };
    const { data: member, error: memberError } = await client.from("group_members").select("user_id")
      .eq("group_id", groupId).eq("user_id", auth.user.id).maybeSingle();
    if (memberError) return { ok: false, status: 503, error: "Could not verify Circle access. Retry." };
    if (!member) return { ok: false, status: 403, error: "Circle membership required" };
    let query = client.from("activities").select(`id,user_id,type,cafe_id,group_id,visit_id,metadata,created_at,
      profile:profiles(id,username,display_name,avatar_url),cafe:cafes(id,name,address),group:groups(id,name)`)
      .eq("group_id", groupId).order("created_at", { ascending: false }).order("id", { ascending: false });
    if (cursor) query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
    const { data, error } = await query.limit(21);
    if (error || !Array.isArray(data)) return { ok: false, status: 503, error: "Could not load Circle activity. Retry." };
    const items = data.slice(0, 20) as unknown as Activity[];
    const last = items.at(-1);
    return { ok: true, data: { items, nextCursor: data.length > 20 && last ? { id: last.id, createdAt: last.created_at } : null } };
  } catch {
    return { ok: false, status: 503, error: "Circle activity is unavailable. Retry." };
  }
}
