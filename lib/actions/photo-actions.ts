"use server";

import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type UploadPhotoResult = { success: boolean; path?: string; url?: string; error?: string };
type SignedPhotoResult = { success: boolean; url?: string; expiresAt?: number; error?: string };
const MAX_BYTES = 5 * 1024 * 1024;
const PATH_PATTERN = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:jpe?g|png|webp)$/i;
const formats: Record<string, string> = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };

async function session() {
  if (!hasSupabaseConfig()) throw new Error("Photo storage is unavailable in demo mode");
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) throw new Error("Authentication required");
  return { client, user: data.user };
}

export async function uploadPhotoAction(formData: FormData): Promise<UploadPhotoResult> {
  try {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { success: false, error: "Choose a photo file" };
    if (file.size > MAX_BYTES) return { success: false, error: "Photo exceeds the 5 MB limit" };
    if (!formats[file.type]) return { success: false, error: "Choose a JPEG, PNG or WebP photo" };
    const { client, user } = await session();
    let bytes: Buffer;
    try {
      const image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 16_000_000, failOn: "warning" });
      const metadata = await image.metadata();
      if (metadata.format !== formats[file.type] || (metadata.pages ?? 1) !== 1) {
        return { success: false, error: "Photo type does not match its contents" };
      }
      bytes = await image.rotate().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 }).toBuffer();
    } catch {
      return { success: false, error: "Could not decode this photo. Choose another image." };
    }
    if (bytes.length > MAX_BYTES) return { success: false, error: "Processed photo exceeds the 5 MB limit" };
    const path = `${user.id}/${randomUUID()}.jpg`;
    const { error } = await client.storage.from("visit-photos").upload(path, bytes, {
      contentType: "image/jpeg", cacheControl: "0", upsert: false,
    });
    if (error) return { success: false, error: "Could not upload photo. Please retry." };
    return { success: true, path };
  } catch (cause) {
    return { success: false, error: cause instanceof Error ? cause.message : "Photo upload failed" };
  }
}

export async function signVisitPhotoAction(path: string): Promise<SignedPhotoResult> {
  try {
    if (typeof path !== "string" || !PATH_PATTERN.test(path)) return { success: false, error: "Invalid photo path" };
    const { client } = await session();
    const { data: allowed, error: accessError } = await client.rpc("can_read_visit_photo", { p_path: path });
    if (accessError || allowed !== true) return { success: false, error: "Photo access is unavailable" };
    const { data, error } = await client.storage.from("visit-photos").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) return { success: false, error: "Could not load photo" };
    return { success: true, url: data.signedUrl, expiresAt: Date.now() + 60_000 };
  } catch {
    return { success: false, error: "Could not authorize photo access" };
  }
}

export async function deleteTemporaryPhotoAction(path: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (typeof path !== "string" || !PATH_PATTERN.test(path)) return { success: false, error: "Invalid photo path" };
    const { client, user } = await session();
    if (!path.startsWith(`${user.id}/`)) return { success: false, error: "Photo belongs to another account" };
    const admin = createAdminClient();
    const { data: claimed, error: checkError } = await client.rpc("claim_temporary_photo_delete", { p_path: path });
    if (checkError || claimed !== true) return { success: false, error: "Attached photos cannot be removed here" };
    const { error } = await admin.storage.from("visit-photos").remove([path]);
    if (error) return { success: false, error: "Could not remove temporary photo" };
    return { success: true };
  } catch {
    return { success: false, error: "Could not remove temporary photo" };
  }
}
