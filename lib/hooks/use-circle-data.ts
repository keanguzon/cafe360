"use client";

import { useEffect, useState } from "react";
import useSWR, { unstable_serialize, useSWRConfig } from "swr";
import { getCircleDataAction, type CircleSnapshot } from "@/lib/actions/circle-data-actions";
import { HttpResponseError } from "@/components/providers/swr-provider";

const WARM_REVALIDATE_MS = 60_000;

export type CircleData = CircleSnapshot & {
  fetchedAt: number;
};

export const circleDataKey = (accountId: string, groupId: string) =>
  ["circle-data", accountId, groupId] as const;

async function fetchCircleData([, , groupId]: ReturnType<typeof circleDataKey>): Promise<CircleData> {
  const result = await getCircleDataAction(groupId);
  if (!result.ok) throw new HttpResponseError(result.error, result.status);
  return { ...result.data, fetchedAt: Date.now() };
}

export function useCircleData(accountId: string, groupId: string | null) {
  const { cache } = useSWRConfig();
  const [revokedScope, setRevokedScope] = useState<{ accountId: string; groupId: string; data: CircleData | undefined; message: string } | null>(null);
  const { data, error, isLoading, isValidating, mutate } = useSWR<CircleData, Error>(
    groupId ? circleDataKey(accountId, groupId) : null,
    fetchCircleData,
    { keepPreviousData: false, revalidateIfStale: false },
  );

  useEffect(() => {
    if (!data || !groupId || !Number.isFinite(data.fetchedAt)) return;
    const remaining = WARM_REVALIDATE_MS - (Date.now() - data.fetchedAt);
    const timer = window.setTimeout(() => { void mutate(); }, Math.max(remaining, 0));
    return () => window.clearTimeout(timer);
  }, [data, groupId, mutate]);

  const status = error && "status" in error ? error.status : null;
  const deniedResponse = status === 401 || status === 403;
  const deniedScope = revokedScope?.accountId === accountId && revokedScope.groupId === groupId;
  const accessRevoked = deniedResponse || (deniedScope && (!data || data === revokedScope.data));
  useEffect(() => {
    if (deniedResponse && groupId) {
      // Keep the denial after eviction removes SWR's error from this shared key.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRevokedScope({ accountId, groupId, data, message: error?.message ?? "Access revoked" });
      cache.delete(unstable_serialize(circleDataKey(accountId, groupId)));
    }
  }, [deniedResponse, accountId, cache, data, error?.message, groupId]);

  const visibleData = accessRevoked ? undefined : data;

  return {
    hasData: !!visibleData,
    members: visibleData?.members ?? [],
    visits: visibleData?.visits ?? [],
    savedCafes: visibleData?.savedCafes ?? [],
    cafeSummaries: visibleData?.cafeSummaries ?? [],
    initialLoading: !!groupId && !visibleData && isLoading,
    refreshing: !!visibleData && isValidating,
    error: error?.message ?? (accessRevoked && deniedScope ? revokedScope.message : null),
    accessRevoked,
    refresh: async () => { await mutate(); },
  };
}
