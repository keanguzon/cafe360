"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import useSWR, { useSWRConfig, unstable_serialize } from "swr";
import { getAccountCirclesAction } from "@/lib/actions/circle-memberships-actions";
import { circleDataKey, useCircleData } from "@/lib/hooks/use-circle-data";
import type { CircleSummary, GroupSavedCafe, CircleMemberInfo } from "@/lib/types/social";
import type { VisitWithDetails } from "@/lib/types/visit";
import type { CircleCafeSummary } from "@/lib/types/circle-cafe";
import { activityFeedCacheKey, isCircleActivityKey } from "@/lib/data/activity-cache-key";
import { HttpResponseError } from "@/components/providers/swr-provider";
import { ReadFeedback } from "@/components/ui/read-feedback";

interface CircleContextType {
  accountId: string;
  activeCircle: CircleSummary | null;
  userCircles: CircleSummary[];
  membershipsResolved: boolean;
  evictMembership: (groupId: string) => void;
  circleMembers: CircleMemberInfo[];
  circleVisits: VisitWithDetails[];
  circleSavedCafes: GroupSavedCafe[];
  circleCafeSummaries: CircleCafeSummary[];
  isLoading: boolean;
  refreshing: boolean;
  error: string | null;
  targetCoordinates: [number, number] | null;
  setActiveCircleId: (id: string | null) => void;
  refreshMemberships: () => Promise<CircleSummary[]>;
  refreshCircleData: () => Promise<void>;
  invalidateCircle: (groupId?: string) => Promise<void>;
}

const CircleContext = createContext<CircleContextType | null>(null);
const selectionKey = (accountId: string) => `cafe360_active_circle_id:${accountId}`;
const membershipsKey = (accountId: string) => ["circle-memberships", accountId] as const;
const accessDenied = (error: unknown) => error instanceof HttpResponseError && (error.status === 401 || error.status === 403);

function clearAccountCache(cache: ReturnType<typeof useSWRConfig>["cache"], accountId: string) {
  for (const key of cache.keys()) {
    const original = (cache.get(key) as { _k?: unknown } | undefined)?._k;
    if (Array.isArray(original) && original[1] === accountId) cache.delete(key);
  }
  cache.delete(unstable_serialize(membershipsKey(accountId)));
}

function isCircleMemoryPhotoKey(key: unknown, accountId: string, groupId: string) {
  return Array.isArray(key) && key[0] === "memory-photo" && key[1] === accountId && key[2] === groupId;
}

function evictCircleCache(cache: ReturnType<typeof useSWRConfig>["cache"], accountId: string, groupId: string) {
  cache.delete(unstable_serialize(circleDataKey(accountId, groupId)));
  cache.delete(activityFeedCacheKey(accountId, groupId));
  for (const key of cache.keys()) {
    const original = (cache.get(key) as { _k?: unknown } | undefined)?._k;
    if (isCircleActivityKey(original, accountId, groupId) || isCircleMemoryPhotoKey(original, accountId, groupId) ||
      Array.isArray(original) && ["sheet-profile", "sheet-memory", "sheet-circle", "sheet-cafe"].includes(original[0]) && original[1] === accountId && original[2] === groupId) {
      cache.delete(key);
    }
  }
}

async function loadMemberships([, accountId]: ReturnType<typeof membershipsKey>) {
  const result = await getAccountCirclesAction(accountId);
  if (!result.ok) throw new HttpResponseError(result.error, result.status);
  return result.data;
}

export function CircleProvider({ children, accountId }: { children: React.ReactNode; accountId: string }) {
  const { cache, mutate: globalMutate } = useSWRConfig();

  useEffect(() => () => {
    for (const key of cache.keys()) cache.delete(key);
  }, [accountId, cache]);

  const [selection, setSelection] = useState<{ accountId: string; id: string | null } | null>(null);
  const [refreshError, setRefreshError] = useState<{ accountId: string; message: string } | null>(null);
  const [accessFailure, setAccessFailure] = useState<{ accountId: string; error: HttpResponseError } | null>(null);
  const [targetCoordinates] = useState<[number, number] | null>(null);
  const departed = useRef(new Map<string, Set<string>>());
  const membershipRevision = useRef(0);
  const [departedMemberships, setDepartedMemberships] = useState(new Map<string, Set<string>>());
  const { data: memberships, error: membershipsError, isLoading: membershipsLoading, isValidating: membershipsValidating, mutate: mutateMemberships } = useSWR<CircleSummary[], Error>(
    membershipsKey(accountId),
    loadMemberships,
    { keepPreviousData: false, revalidateIfStale: false },
  );
  const denied = accessFailure?.accountId === accountId || accessDenied(membershipsError);
  const userCircles = useMemo(() => denied ? [] : (memberships ?? []).filter((circle) => !departedMemberships.get(accountId)?.has(circle.id)), [accountId, denied, memberships, departedMemberships]);
  const membershipsResolved = denied || memberships !== undefined;
  const preferredId = selection?.accountId === accountId
    ? selection.id
    : typeof window !== "undefined" ? localStorage.getItem(selectionKey(accountId)) : null;
  const activeCircleId = userCircles.find((circle) => circle.id === preferredId)?.id ?? userCircles[0]?.id ?? null;
  const activeCircle = userCircles.find((circle) => circle.id === activeCircleId) ?? null;
  const circleData = useCircleData(accountId, activeCircle?.id ?? null);

  useEffect(() => {
    if (accessDenied(membershipsError)) clearAccountCache(cache, accountId);
  }, [accountId, cache, membershipsError]);

  useEffect(() => {
    if (!memberships) return;
    if (activeCircleId) localStorage.setItem(selectionKey(accountId), activeCircleId);
    else localStorage.removeItem(selectionKey(accountId));
  }, [accountId, activeCircleId, memberships]);

  const setActiveCircleId = useCallback((id: string | null) => {
    setSelection({ accountId, id });
    if (id) localStorage.setItem(selectionKey(accountId), id);
    else localStorage.removeItem(selectionKey(accountId));
  }, [accountId]);

  const refreshMemberships = useCallback(async () => {
    const revision = ++membershipRevision.current;
    try {
      const fresh = await loadMemberships(membershipsKey(accountId));
      if (revision !== membershipRevision.current) return fresh.filter((circle) => !departed.current.get(accountId)?.has(circle.id));
      for (const circle of userCircles) {
        if (!fresh.some((member) => member.id === circle.id)) {
          evictCircleCache(cache, accountId, circle.id);
        }
      }
      setSelection((current) => {
        if (current?.accountId === accountId && current.id && !fresh.some((member) => member.id === current.id)) {
          return { accountId, id: fresh[0]?.id ?? null };
        }
        return current;
      });
      await mutateMemberships(fresh, { revalidate: false });
      const removed = departed.current.get(accountId);
      if (removed) for (const id of removed) {
        if (!fresh.some((circle) => circle.id === id)) removed.delete(id);
      }
      setDepartedMemberships(new Map(Array.from(departed.current, ([id, ids]) => [id, new Set(ids)])));
      setAccessFailure(null);
      setRefreshError(null);
      return fresh;
    } catch (cause) {
      if (revision !== membershipRevision.current) throw cause;
      if (accessDenied(cause)) {
        setAccessFailure({ accountId, error: cause as HttpResponseError });
        clearAccountCache(cache, accountId);
      }
      setRefreshError({ accountId, message: cause instanceof Error ? cause.message : "Could not refresh circles" });
      throw cause;
    }
  }, [accountId, cache, mutateMemberships, userCircles]);

  const evictMembership = useCallback((groupId: string) => {
    membershipRevision.current += 1;
    const removed = departed.current.get(accountId) ?? new Set<string>();
    removed.add(groupId);
    departed.current.set(accountId, removed);
    setDepartedMemberships(new Map(Array.from(departed.current, ([id, ids]) => [id, new Set(ids)])));
    evictCircleCache(cache, accountId, groupId);
    void mutateMemberships((current) => current?.filter((circle) => circle.id !== groupId), { revalidate: false });
  }, [accountId, cache, mutateMemberships]);

  useEffect(() => {
    if (!memberships) return;
    const recheck = () => { void refreshMemberships().catch(() => undefined); };
    const onResume = () => { if (document.visibilityState === "visible") recheck(); };
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("focus", recheck);
    window.addEventListener("pageshow", recheck);
    const interval = window.setInterval(recheck, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("focus", recheck);
      window.removeEventListener("pageshow", recheck);
      window.clearInterval(interval);
    };
  }, [memberships, refreshMemberships]);

  const refreshCircleData = circleData.refresh;
  const invalidateCircle = useCallback(async (groupId?: string) => {
    const target = groupId ?? activeCircle?.id;
    if (!target) return;
    const key = circleDataKey(accountId, target);
    const activityKey = activityFeedCacheKey(accountId, target);
    if (target === activeCircle?.id) {
      await Promise.all([globalMutate(key), globalMutate(activityKey)]);
    } else {
      evictCircleCache(cache, accountId, target);
    }
  }, [accountId, activeCircle?.id, cache, globalMutate]);

  return (
    <CircleContext.Provider value={{
      accountId,
      activeCircle,
      userCircles,
      membershipsResolved,
      evictMembership,
      circleMembers: denied ? [] : circleData.members,
      circleVisits: denied ? [] : circleData.visits,
      circleSavedCafes: denied ? [] : circleData.savedCafes,
      circleCafeSummaries: denied ? [] : circleData.cafeSummaries,
      isLoading: membershipsLoading || circleData.initialLoading,
      refreshing: membershipsValidating || circleData.refreshing,
      error: (refreshError?.accountId === accountId ? refreshError.message : null) ?? (accessFailure?.accountId === accountId ? accessFailure.error.message : null) ?? membershipsError?.message ?? circleData.error,
      targetCoordinates,
      setActiveCircleId,
      refreshMemberships,
      refreshCircleData,
      invalidateCircle,
    }}>
      {children}
    </CircleContext.Provider>
  );
}

export function useCircle() {
  const context = useContext(CircleContext);
  if (!context) throw new Error("useCircle must be used within a CircleProvider");
  return context;
}

export function CircleAccessBoundary({ groupId, children }: { groupId: string; children: React.ReactNode }) {
  const { accountId, membershipsResolved, userCircles, error, refreshMemberships } = useCircle();
  if (!membershipsResolved) return <ReadFeedback pending error={error} operationKey={`access:${accountId}:${groupId}`} label="Loading Circle…" retry={refreshMemberships}/>;
  if (!userCircles.some((circle) => circle.id === groupId)) return <p role="status">This Circle is no longer available.</p>;
  return children;
}

