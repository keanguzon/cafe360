"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { validateProfile } from "@/lib/validation/auth";
import { emailDisplayName, isProfileSetupComplete } from "@/lib/auth/profile-setup";

export async function checkUsernameSetAction(): Promise<{
  hasUsername: boolean;
  username?: string;
  displayName?: string;
  error?: string;
}> {
  if (!hasSupabaseConfig()) {
    return { hasUsername: false, username: "", displayName: "Preview User" };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { hasUsername: false, error: 'Please sign in to set up your profile.' };

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) return { hasUsername: false, error: 'Could not load your profile. Please try again.' };

    const metaName =
      user.user_metadata?.display_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      "";

    if (!isProfileSetupComplete(profile, user.id)) {
      return {
        hasUsername: false,
        username: "",
        displayName: emailDisplayName(user.email) || metaName,
      };
    }

    return {
      hasUsername: true,
      username: profile!.username,
      displayName: profile!.display_name || metaName,
    };
  } catch {
    return { hasUsername: false, error: 'Could not load your profile. Please try again.' };
  }
}

export async function setUsernameAction(params: {
  username: string;
  displayName: string;
}): Promise<{ success: boolean; error?: string }> {
  const username = params.username.trim().toLowerCase();
  const displayName = params.displayName.trim();

  const validation = validateProfile({ username, displayName, bio: "" });
  if ("error" in validation) {
    return { success: false, error: validation.error };
  }

  if (!hasSupabaseConfig()) {
    return { success: true };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        username: validation.username,
        display_name: validation.displayName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: "Username is already taken. Please choose another." };
      }
      return { success: false, error: error.message };
    }

    revalidatePath("/profile");
    revalidatePath("/onboarding");
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to set username",
    };
  }
}
