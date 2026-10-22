"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";

import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { validateAvatar, validateProfile } from "@/lib/validation/auth";

export type ProfileActionState = {
  error?: string | null;
  message?: string | null;
  success?: boolean;
};

export async function updateProfileAction(
  _prevState: ProfileActionState | null,
  formData: FormData,
): Promise<ProfileActionState> {
  const displayName = String(formData.get("displayName") || "");
  const username = String(formData.get("username") || "");
  const bio = String(formData.get("bio") || "");

  const validation = validateProfile({ bio, displayName, username });
  if ("error" in validation) {
    return { error: validation.error };
  }

  if (!hasSupabaseConfig()) {
    return {
      error: "Supabase is not configured. Add credentials in .env.local.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to update your profile." };
  }

  const { error } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      bio: validation.bio || null,
      display_name: validation.displayName,
      username: validation.username,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") {
      return { error: "This username is already taken. Please choose another." };
    }
    return { error: error.message };
  }

  revalidatePath("/profile");
  revalidatePath(`/profile/${validation.username}`);
  return { success: true, message: "Profile updated successfully." };
}

export async function uploadAvatarAction(
  formData: FormData,
): Promise<{ error?: string; avatarUrl?: string; success?: boolean }> {
  const file = formData.get("avatar") as File | null;

  if (!file || !(file instanceof File) || file.size === 0) {
    return { error: "Please select an image file to upload." };
  }

  const validation = validateAvatar({ size: file.size, type: file.type });
  if (validation?.error) {
    return { error: validation.error };
  }

  if (!hasSupabaseConfig()) {
    return {
      error: "Supabase is not configured. Add credentials in .env.local.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to upload an avatar." };
  }

  let bytes: Buffer;
  try {
    const formats: Record<string, string> = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };
    const image = sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 16_000_000,
      failOn: "warning",
    });
    const metadata = await image.metadata();
    if (metadata.format !== formats[file.type] || (metadata.pages ?? 1) !== 1) {
      return { error: "Image type does not match its contents or is animated. Choose a still JPEG, PNG, or WebP image." };
    }
    bytes = await image.rotate()
      .resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 }).toBuffer();
  } catch {
    return { error: "Could not decode this image. Choose another image." };
  }

  const filePath = `${user.id}/avatar-${Date.now()}.webp`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, bytes, {
      upsert: true,
      contentType: "image/webp",
    });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(filePath);

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", user.id);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath("/profile");
  return { success: true, avatarUrl: publicUrl };
}
