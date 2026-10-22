"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import type { CafeSearchResult } from "@/lib/types/places";
import { HttpResponseError } from "@/components/providers/swr-provider";

type UseCafesOptions = {
  initialQuery?: string;
  initialCoords?: [number, number];
  autoFetch?: boolean;
  accountId?: string;
  radiusMeters?: number;
  limit?: number;
};

type CachedSearch = { results: CafeSearchResult[]; fetchedAt: number };
const EMPTY_RESULTS: CafeSearchResult[] = [];

async function searchCafes([, url]: readonly [string, string]): Promise<CachedSearch> {
  const response = await fetch(url);
  if (!response.ok) {
    let message = `Search failed (${response.status})`;
    try {
      const body: unknown = await response.json();
      if (body && typeof body === "object" && "error" in body && typeof body.error === "string") message = body.error;
    } catch { /* Keep the HTTP status when the body is not JSON. */ }
    throw new HttpResponseError(message, response.status);
  }
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || !("results" in body) || !Array.isArray(body.results)) {
    throw new Error("Invalid café search response");
  }
  return { results: body.results as CafeSearchResult[], fetchedAt: Date.now() };
}

export function useCafes({
  initialQuery = "",
  initialCoords,
  autoFetch = true,
  accountId = "development-preview",
  radiusMeters = 1500,
  limit = 50,
}: UseCafesOptions = {}) {
  const [query, setQuery] = useState(initialQuery);
  const [manualCoords, setManualCoords] = useState<{ accountId: string; value: [number, number] } | null>(null);
  const [selectedCafe, setSelectedCafe] = useState<CafeSearchResult | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [manualFetch, setManualFetch] = useState(false);
  const coords = manualCoords?.accountId === accountId ? manualCoords.value : initialCoords;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const setCoords = (value: [number, number] | undefined) => {
    setManualCoords(value ? { accountId, value } : null);
  };

  const searchParams = new URLSearchParams();
  const trimmedQuery = debouncedQuery.trim();
  if (trimmedQuery.length >= 2) searchParams.set("q", trimmedQuery);
  if (coords) {
    searchParams.set("lng", String(coords[0]));
    searchParams.set("lat", String(coords[1]));
  }
  searchParams.set("radius", String(radiusMeters));
  searchParams.set("limit", String(limit));
  const key = autoFetch || manualFetch ? ([accountId, `/api/places/search?${searchParams}`] as const) : null;
  const { data, error, isLoading, isValidating, mutate } = useSWR<CachedSearch>(key, searchCafes, {
    keepPreviousData: false,
    revalidateIfStale: false,
    revalidateOnFocus: true,
    shouldRetryOnError: false,
    dedupingInterval: 60_000,
  });

  useEffect(() => {
    if (!data) return;
    const remaining = Math.max(0, 60_000 - (Date.now() - data.fetchedAt));
    const timer = window.setTimeout(() => { void mutate().catch(() => undefined); }, remaining);
    return () => window.clearTimeout(timer);
  }, [data, mutate]);

  const fetchCafes = async (searchTerm: string, searchCoords?: [number, number]) => {
    const nextCoords = searchCoords ?? coords;
    const nextQuery = searchTerm.trim().length >= 2 ? searchTerm.trim() : "";
    const sameRequest = nextQuery === (trimmedQuery.length >= 2 ? trimmedQuery : "")
      && nextCoords?.[0] === coords?.[0] && nextCoords?.[1] === coords?.[1];
    setQuery(searchTerm);
    setDebouncedQuery(searchTerm);
    if (searchCoords) setCoords(searchCoords);
    setManualFetch(true);
    if (key && sameRequest) await mutate().catch(() => undefined);
  };

  const revoked = error instanceof HttpResponseError && (error.status === 401 || error.status === 403);
  return {
    completedSearch: data && !error && coords && key ? {
      query: trimmedQuery.length >= 2 ? trimmedQuery : "",
      coordinates: coords,
      radiusMeters,
      limit,
    } : null,
    cafes: revoked ? EMPTY_RESULTS : data?.results ?? EMPTY_RESULTS,
    query,
    setQuery,
    coords,
    setCoords,
    isLoading: !data && isLoading,
    isRefreshing: !!data && isValidating,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    selectedCafe,
    setSelectedCafe,
    fetchCafes,
  };
}
