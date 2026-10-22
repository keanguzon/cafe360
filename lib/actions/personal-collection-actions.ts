"use server";

import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { getSavedCafesAction, getUserCollectionsAction, isCafeSavedAction } from "@/lib/actions/cafe-actions";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { CollectionSummary, SavedCafe } from "@/lib/types/saved-cafe";

type ReadResult<T> = { ok: true; data: T } | { ok: false; status: 401 | 403 | 503; error: string };
type Failure = Extract<ReadResult<never>, { ok: false }>;

async function verifyAccount(expectedAccountId: string): Promise<Failure | null> {
  if (!hasSupabaseConfig()) {
    return expectedAccountId === "development-preview" ? null : { ok: false, status: 403, error: "Account changed" };
  }
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      const status = isAuthSessionMissingError(error) ? 401 : error.status === 401 || error.status === 403 ? error.status : 503;
      return { ok: false, status, error: status === 503 ? "Could not verify account" : "Not authenticated" };
    }
    if (!user) return { ok: false, status: 401, error: "Not authenticated" };
    if (user.id !== expectedAccountId) return { ok: false, status: 403, error: "Account changed" };
    return null;
  } catch {
    return { ok: false, status: 503, error: "Could not verify account" };
  }
}

async function accountRead<T>(expectedAccountId: string, read: () => Promise<T>): Promise<ReadResult<T>> {
  const failure = await verifyAccount(expectedAccountId);
  if (failure) return failure;
  try {
    const data = await read();
    const subsequentFailure = await verifyAccount(expectedAccountId);
    if (subsequentFailure) return subsequentFailure;
    return { ok: true, data };
  } catch (cause) {
    const authFailure = await verifyAccount(expectedAccountId);
    if (authFailure?.status === 401 || authFailure?.status === 403) return authFailure;
    return { ok: false, status: 503, error: cause instanceof Error ? cause.message : "Could not load saved cafés" };
  }
}

export async function getAccountCollectionsAction(expectedAccountId: string): Promise<ReadResult<CollectionSummary[]>> {
  return accountRead(expectedAccountId, getUserCollectionsAction);
}

export async function getAccountSavedCafesAction(expectedAccountId: string, collectionName: string): Promise<ReadResult<SavedCafe[]>> {
  return accountRead(expectedAccountId, () => getSavedCafesAction(collectionName));
}

export type CafeSaveStatus = { isSaved: boolean; collections: string[] };

export async function getAccountCafeSaveStatusAction(expectedAccountId: string, cafeId: string): Promise<ReadResult<CafeSaveStatus>> {
  if (!hasSupabaseConfig()) return accountRead(expectedAccountId, () => isCafeSavedAction(cafeId));
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      const status = isAuthSessionMissingError(authError) ? 401 : authError.status === 401 || authError.status === 403 ? authError.status : 503;
      return { ok: false, status, error: status === 503 ? "Could not verify account" : "Not authenticated" };
    }
    if (!user) return { ok: false, status: 401, error: "Not authenticated" };
    if (user.id !== expectedAccountId) return { ok: false, status: 403, error: "Account changed" };
    let internalId: string | null = null;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cafeId)) {
      const { data, error } = await supabase.from("cafes").select("id").eq("id", cafeId).maybeSingle();
      if (error) throw new Error(error.message);
      internalId = data?.id ?? null;
    }
    if (!internalId) {
      const { data, error } = await supabase.from("cafes").select("id").eq("provider_place_id", cafeId).maybeSingle();
      if (error) throw new Error(error.message);
      internalId = data?.id ?? null;
    }
    if (!internalId) return { ok: true, data: { isSaved: false, collections: [] } };
    const { data, error } = await supabase.from("saved_cafes").select("collection").eq("user_id", user.id).eq("cafe_id", internalId);
    if (error) throw new Error(error.message);
    const collections = (data ?? []).map((row: { collection: string }) => row.collection);
    return { ok: true, data: { isSaved: collections.length > 0, collections } };
  } catch (cause) {
    return { ok: false, status: 503, error: cause instanceof Error ? cause.message : "Could not load saved status" };
  }
}
