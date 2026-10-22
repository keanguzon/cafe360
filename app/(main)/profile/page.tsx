import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/profile";
import { StandaloneProfileContent } from "@/components/sheet/profile-content";
import { readSheetProfileAction } from "@/lib/actions/sheet-read-actions";


export const metadata: Metadata = {
  title: "Your Profile — Cafe360",
  description: "Manage your Cafe360 profile, stats, and café memories",
};

export default async function ProfilePage() {
  let profile: Profile | null = null;

  if (!hasSupabaseConfig()) {
    profile = {
      id: "preview-user",
      username: "cafe_explorer",
      display_name: "Coffee Explorer",
      avatar_url: null,
      bio: "Local explorer in Cavite. Add your Supabase keys in .env.local to link your real account.",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login?next=%2Fprofile");
    }

    const result = await readSheetProfileAction({ expectedAccountId: user.id });
    const profileData = result.ok ? result.data : null;

    if (profileData) {
      profile = profileData as Profile;
    } else {
      profile = {
        id: user.id,
        username:
          user.user_metadata?.username ||
          user.user_metadata?.email?.split("@")[0]?.replace(/[^a-z0-9_]/gi, "_").toLowerCase() ||
          `user_${user.id.slice(0, 8)}`,
        display_name:
          user.user_metadata?.display_name ||
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          "Cafe Explorer",
        avatar_url:
          user.user_metadata?.avatar_url ||
          user.user_metadata?.picture ||
          null,
        bio: null,
        created_at: user.created_at,
        updated_at: user.created_at,
      };
    }
  }

  return <StandaloneProfileContent accountId={profile.id} initialProfile={profile} preview={!hasSupabaseConfig()} />;
}
