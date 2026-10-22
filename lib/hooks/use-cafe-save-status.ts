"use client";

import { useCallback, useEffect, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import type { CafeSaveStatus } from "@/lib/actions/personal-collection-actions";
import { fetchJson, HttpResponseError } from "@/components/providers/swr-provider";
import { isPersonalCollectionKey } from "./use-saved-cafes";

export const cafeSaveStatusKey = (accountId: string, cafeId: string) => ["personal-cafe-save-status", accountId, cafeId] as const;
type TimedStatus = { status: CafeSaveStatus; fetchedAt: number };
async function load([, accountId, cafeId]: ReturnType<typeof cafeSaveStatusKey>): Promise<TimedStatus> {
  const query = new URLSearchParams({ accountId, cafeId });
  const status = await fetchJson(`/api/personal/cafe-save-status?${query}`, {
    cache: "no-store",
    credentials: "same-origin",
  }) as CafeSaveStatus;
  return { status, fetchedAt: Date.now() };
}

export function useCafeSaveStatus(accountId: string, cafeId: string, enabled: boolean) {
  const { mutate: globalMutate } = useSWRConfig();
  const [accessFailure, setAccessFailure] = useState<{ accountId: string; cafeId: string; error: HttpResponseError } | null>(null);
  const fetcher = useCallback(async (key: ReturnType<typeof cafeSaveStatusKey>) => {
    try {
      const data = await load(key);
      setAccessFailure((previous) => previous?.accountId === key[1] && previous.cafeId === key[2] ? null : previous);
      return data;
    } catch (cause) {
      if (cause instanceof HttpResponseError && (cause.status === 401 || cause.status === 403)) {
        setAccessFailure({ accountId: key[1], cafeId: key[2], error: cause });
      }
      throw cause;
    }
  }, []);
  const { data, error, mutate } = useSWR<TimedStatus, Error>(
    cafeSaveStatusKey(accountId, cafeId), fetcher,
    { keepPreviousData: false, revalidateIfStale: false, shouldRetryOnError: false, ...(enabled ? {} : { revalidateOnMount: false }) },
  );
  const scopedFailure = accessFailure?.accountId === accountId && accessFailure.cafeId === cafeId ? accessFailure.error : undefined;
  const denied = !!scopedFailure || error instanceof HttpResponseError && (error.status === 401 || error.status === 403);
  useEffect(() => {
    if (denied) void globalMutate((key) => isPersonalCollectionKey(key, accountId), undefined, { revalidate: false });
  }, [accountId, denied, globalMutate]);
  useEffect(() => {
    if (!enabled || !data) return;
    const timer = window.setTimeout(() => { void mutate(); }, Math.max(0, 60_000 - (Date.now() - data.fetchedAt)));
    return () => window.clearTimeout(timer);
  }, [data, enabled, mutate]);
  return { status: denied ? undefined : data?.status, error: scopedFailure ?? error, refresh: () => mutate(), mutate };
}
