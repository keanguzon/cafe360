"use server";

import { getUserCirclesSummaryAction } from "@/lib/actions/group-actions";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { CircleSummary } from "@/lib/types/social";

export type AccountCirclesResult =
  | { ok: true; data: CircleSummary[] }
  | { ok: false; status: 401 | 403 | 503; error: string };

export async function getAccountCirclesAction(expectedAccountId: string): Promise<AccountCirclesResult> {
  if (!hasSupabaseConfig()) {
    if (expectedAccountId !== "development-preview") return { ok: false, status: 403, error: "Account changed" };
  } else {
    try {
      const supabase = await createClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        const status = error.status === 401 || error.status === 403 ? error.status : 503;
        return { ok: false, status, error: status === 503 ? "Could not verify account" : "Not authenticated" };
      }
      if (!user) return { ok: false, status: 401, error: "Not authenticated" };
      if (user.id !== expectedAccountId) return { ok: false, status: 403, error: "Account changed" };
    } catch {
      return { ok: false, status: 503, error: "Could not verify account" };
    }
  }

  try {
    return { ok: true, data: await getUserCirclesSummaryAction() };
  } catch (cause) {
    if (hasSupabaseConfig()) {
      try {
        const supabase = await createClient();
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error?.status === 401 || error?.status === 403) {
          return { ok: false, status: error.status, error: "Not authenticated" };
        }
        if (!error && !user) return { ok: false, status: 401, error: "Not authenticated" };
        if (!error && user?.id !== expectedAccountId) return { ok: false, status: 403, error: "Account changed" };
      } catch {
        // Keep the read failure status when account verification is unavailable.
      }
    }
    return { ok: false, status: 503, error: cause instanceof Error ? cause.message : "Could not load Circles" };
  }
}
