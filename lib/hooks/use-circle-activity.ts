"use client";

import { useEffect } from "react";
import useSWRInfinite from "swr/infinite";
import { getCircleActivityPageAction } from "@/lib/actions/circle-activity-actions";
import { activityPageKey } from "@/lib/data/activity-cache-key";
import { HttpResponseError } from "@/components/providers/swr-provider";
import type { ActivityPage } from "@/lib/types/activity-page";

export function useCircleActivity(accountId: string, groupId: string | null) {
  const { data, error, isLoading, isValidating, mutate, size, setSize } = useSWRInfinite<ActivityPage, HttpResponseError>(
    (_index, previous: ActivityPage | null) => {
      if (!groupId || (previous && !previous.nextCursor)) return null;
      return activityPageKey(accountId, groupId, previous?.nextCursor ?? null);
    },
    async ([, , circleId, cursor]: ReturnType<typeof activityPageKey>) => {
      const result = await getCircleActivityPageAction(circleId, cursor);
      if (!result.ok) throw new HttpResponseError(result.error, result.status);
      return result.data;
    },
    { revalidateAll: true, revalidateOnFocus: true, revalidateIfStale: false, persistSize: false, shouldRetryOnError: false },
  );
  useEffect(() => {
    if (!groupId) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void mutate().catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [groupId, mutate]);
  const revoked = error?.status === 401 || error?.status === 403;
  const activities = !groupId || revoked ? [] : [...new Map((data ?? []).flatMap((page) => page.items).map((item) => [item.id, item])).values()];
  return {
    activities, error: error?.message ?? null,
    initialLoading: !!groupId && isLoading && !data,
    refreshing: isValidating,
    hasMore: !revoked && !!data?.at(-1)?.nextCursor,
    refresh: async () => { await mutate(); },
    loadMore: async () => { await setSize(size + 1); },
  };
}
