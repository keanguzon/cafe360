"use client";

import { useCallback, useEffect, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { getAccountSavedCafesAction, getAccountCollectionsAction } from "@/lib/actions/personal-collection-actions";
import { HttpResponseError } from "@/components/providers/swr-provider";
import type { CollectionSummary, SavedCafe } from "@/lib/types/saved-cafe";

const WARM_REVALIDATE_MS = 60_000;
type Timed<T> = { items: T; fetchedAt: number };

export const personalCollectionsKey = (accountId: string) => ["personal-collections", accountId] as const;
export const savedCafesKey = (accountId: string, collectionName: string) => ["personal-saved-cafes", accountId, collectionName] as const;

export function isPersonalCollectionKey(key: unknown, accountId: string) {
  return Array.isArray(key) && key[1] === accountId &&
    (key[0] === "personal-collections" || key[0] === "personal-saved-cafes" || key[0] === "personal-cafe-save-status");
}

export function isCafeSaveMutationKey(key: unknown, accountId: string, cafeId: string) {
  return Array.isArray(key) && isPersonalCollectionKey(key, accountId) &&
    (key[0] !== "personal-cafe-save-status" || key[2] === cafeId);
}

function isAccessDenied(error: unknown) {
  return error instanceof HttpResponseError && (error.status === 401 || error.status === 403);
}

async function loadCollections([, accountId]: ReturnType<typeof personalCollectionsKey>) {
  const result = await getAccountCollectionsAction(accountId);
  if (!result.ok) throw new HttpResponseError(result.error, result.status);
  return { items: result.data, fetchedAt: Date.now() };
}

async function loadSavedCafes([, accountId, collectionName]: ReturnType<typeof savedCafesKey>) {
  const result = await getAccountSavedCafesAction(accountId, collectionName);
  if (!result.ok) throw new HttpResponseError(result.error, result.status);
  return { items: result.data, fetchedAt: Date.now() };
}

function useClearDeniedAccount(accountId: string, error: unknown) {
  const { mutate } = useSWRConfig();
  const denied = isAccessDenied(error);
  useEffect(() => {
    if (denied) {
      void mutate((key) => isPersonalCollectionKey(key, accountId), undefined, { revalidate: false });
    }
  }, [accountId, denied, mutate]);
  return denied;
}

export function usePersonalCollections(accountId: string, enabled = true) {
  const [accessFailure, setAccessFailure] = useState<{ accountId: string; message: string } | null>(null);
  const fetcher = useCallback(async (key: ReturnType<typeof personalCollectionsKey>) => {
    try {
      const result = await loadCollections(key);
      setAccessFailure(null);
      return result;
    } catch (cause) {
      if (isAccessDenied(cause)) setAccessFailure({ accountId: key[1], message: (cause as Error).message });
      throw cause;
    }
  }, []);
  const { data, error, isLoading, isValidating, mutate } = useSWR<Timed<CollectionSummary[]>, Error>(
    enabled ? personalCollectionsKey(accountId) : null,
    fetcher,
    { keepPreviousData: false, revalidateIfStale: false },
  );
  const denied = useClearDeniedAccount(accountId, error) || accessFailure?.accountId === accountId;
  useEffect(() => {
    if (!enabled || !data) return;
    const remaining = WARM_REVALIDATE_MS - (Date.now() - data.fetchedAt);
    const timer = window.setTimeout(() => { void mutate(); }, Math.max(remaining, 0));
    return () => window.clearTimeout(timer);
  }, [data, enabled, mutate]);
  return {
    collections: denied ? [] : data?.items ?? [],
    initialLoading: !data && isLoading,
    refreshing: !!data && isValidating,
    error: accessFailure?.accountId === accountId ? accessFailure.message : error?.message ?? null,
    refresh: async () => { await mutate(); },
  };
}

export function useSavedCafes(accountId: string, collectionName: string, enabled = true) {
  const [accessFailure, setAccessFailure] = useState<{ accountId: string; message: string } | null>(null);
  const fetcher = useCallback(async (key: ReturnType<typeof savedCafesKey>) => {
    try {
      const result = await loadSavedCafes(key);
      setAccessFailure(null);
      return result;
    } catch (cause) {
      if (isAccessDenied(cause)) setAccessFailure({ accountId: key[1], message: (cause as Error).message });
      throw cause;
    }
  }, []);
  const { data, error, isLoading, isValidating, mutate } = useSWR<Timed<SavedCafe[]>, Error>(
    enabled ? savedCafesKey(accountId, collectionName) : null,
    fetcher,
    { keepPreviousData: false, revalidateIfStale: false },
  );
  const denied = useClearDeniedAccount(accountId, error) || accessFailure?.accountId === accountId;
  useEffect(() => {
    if (!enabled || !data) return;
    const remaining = WARM_REVALIDATE_MS - (Date.now() - data.fetchedAt);
    const timer = window.setTimeout(() => { void mutate(); }, Math.max(remaining, 0));
    return () => window.clearTimeout(timer);
  }, [data, enabled, mutate]);
  return {
    savedCafes: denied ? [] : data?.items ?? [],
    initialLoading: !data && isLoading,
    refreshing: !!data && isValidating,
    error: accessFailure?.accountId === accountId ? accessFailure.message : error?.message ?? null,
    refresh: async () => { await mutate(); },
  };
}
