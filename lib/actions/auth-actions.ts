"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { validateCredentials, validateSignUp } from "@/lib/validation/auth";
import { getAppUrl } from "@/lib/config/app";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";

export type AuthActionState = {
  error?: string | null;
  message?: string | null;
  success?: boolean;
};

export async function loginAction(
  _prevState: AuthActionState | null,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/profile");

  const validation = validateCredentials(email, password);
  if ("error" in validation) {
    return { error: validation.error };
  }

  if (!hasSupabaseConfig()) {
    return {
      error: "Supabase credentials are not configured. Please add them to .env.local.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: validation.email,
    password: validation.password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect(getSafeRedirectPath(next, getAppUrl({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NODE_ENV: process.env.NODE_ENV,
  }), "/profile"));
}

export async function signupAction(
  _prevState: AuthActionState | null,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const displayName = String(formData.get("displayName") || "");
  const username = String(formData.get("username") || "");
  const siteUrl = getAppUrl({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NODE_ENV: process.env.NODE_ENV,
  });
  const next = getSafeRedirectPath(String(formData.get("next") || "/profile"), siteUrl, "/profile");

  const validation = validateSignUp({
    displayName,
    email,
    password,
    username,
  });

  if ("error" in validation) {
    return { error: validation.error };
  }

  if (!hasSupabaseConfig()) {
    return {
      error: "Supabase credentials are not configured. Please add them to .env.local.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: validation.email,
    password: validation.password,
    options: {
      emailRedirectTo: `${siteUrl}/callback?${new URLSearchParams({ next })}`,
      data: {
        display_name: validation.displayName,
        username: validation.username,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.user && !data.session) {
    return {
      success: true,
      message: "Check your email for a confirmation link to complete registration.",
    };
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function logoutAction(): Promise<{ error: string } | null> {
  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    try {
      const { error } = await supabase.auth.signOut();
      if (error) return { error: "Could not sign out. Please try again." };
    } catch {
      return { error: "Could not sign out. Please try again." };
    }
  }

  revalidatePath("/", "layout");
  redirect("/login");
}

export async function forgotPasswordAction(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const email = String(formData.get("email") || "").trim().toLowerCase();

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }

  if (!hasSupabaseConfig()) {
    return { success: true };
  }

  const supabase = await createClient();
  const siteUrl = getAppUrl({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NODE_ENV: process.env.NODE_ENV,
  });
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/callback?next=/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function updatePasswordAction(formData: FormData): Promise<AuthActionState> {
  const password = String(formData.get("password") || "");
  const confirmation = String(formData.get("confirmPassword") || "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", success: false };
  }
  if (password !== confirmation) {
    return { error: "Passwords do not match.", success: false };
  }
  if (!hasSupabaseConfig()) {
    return { error: "Password reset is not configured.", success: false };
  }

  const supabase = await createClient();
  const { data, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !data.user) {
    return { error: "Your reset session has expired. Request a new link.", success: false };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: "Could not update your password. Please try again.", success: false };
  }
  return { success: true, message: "Password updated." };
}
