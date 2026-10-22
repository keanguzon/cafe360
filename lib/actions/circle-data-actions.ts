"use server";

import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getCircleMembersAction, getGroupSavedCafesAction } from "./group-actions";
import { getCircleVisitsAction } from "./visit-actions";
import { getCircleCafeSummariesAction } from "./circle-cafe-actions";
import type { CircleMemberInfo, GroupSavedCafe } from "@/lib/types/social";
import type { VisitWithDetails } from "@/lib/types/visit";
import type { CircleCafeSummary } from "@/lib/types/circle-cafe";

export type CircleSnapshot = {
  members: CircleMemberInfo[];
  visits: VisitWithDetails[];
  savedCafes: GroupSavedCafe[];
  cafeSummaries: CircleCafeSummary[];
};

export type CircleDataResult =
  | { ok: true; data: CircleSnapshot }
  | { ok: false; status: number; error: string };

export async function getCircleDataAction(groupId: string): Promise<CircleDataResult> {
  if (!groupId || typeof groupId !== "string") {
    return { ok: false, status: 400, error: "Circle ID is required" };
  }

  if (hasSupabaseConfig()) {
    try {
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return { ok: false, status: 401, error: "Session expired" };
      const { data: membership, error: membershipError } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (membershipError) return { ok: false, status: 503, error: membershipError.message };
      if (!membership) return { ok: false, status: 403, error: "Circle membership required" };
    } catch (cause) {
      return { ok: false, status: 503, error: cause instanceof Error ? cause.message : "Could not verify Circle membership" };
    }
  }

  try {
    const [members, visits, savedCafes, cafeSummaries] = await Promise.all([
      getCircleMembersAction(groupId),
      getCircleVisitsAction(groupId),
      getGroupSavedCafesAction(groupId),
      getCircleCafeSummariesAction(groupId),
    ]);
    return { ok: true, data: { members, visits, savedCafes, cafeSummaries } };
  } catch (cause) {
    return { ok: false, status: 503, error: cause instanceof Error ? cause.message : "Could not load Circle data" };
  }
}
