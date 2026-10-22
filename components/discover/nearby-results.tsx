"use client";
import { ReadFeedback } from "@/components/ui/read-feedback";

import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { CafeCard } from "@/components/cafe/cafe-card";
import { CafeDetailSheet } from "@/components/cafe/cafe-detail-sheet";
import { useCafes } from "@/lib/hooks/use-cafes";
import { useCircle } from "@/lib/context/circle-context";
import { useNavigationState, type NavigationSnapshot } from "@/lib/context/navigation-state";

export function NearbyFromMap() {
  const { nearbyList } = useNavigationState();
  if (nearbyList) return <NearbyResults key={JSON.stringify(nearbyList)} search={nearbyList} />;
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6 pb-28 sm:px-6">
      <h1 className="text-xl font-bold tracking-tight text-foreground">Nearby cafés</h1>
      <p className="text-sm text-muted-foreground">Your map search is no longer available. Search an area on the map, then choose List nearby.</p>
      <Link href="/map" className="inline-flex min-h-11 items-center text-sm font-medium text-accent underline">Return to map</Link>
    </div>
  );
}

export function NearbyResults({ search }: { search: NonNullable<NavigationSnapshot["nearbyList"]> }) {
  const { accountId, circleCafeSummaries } = useCircle();
  const { cafes, isLoading, error, fetchCafes, selectedCafe, setSelectedCafe } = useCafes({
    accountId, initialQuery: search.query, initialCoords: search.coordinates,
    radiusMeters: search.radiusMeters, limit: search.limit,
  });
  const results = cafes.map((cafe) => {
    const summary = circleCafeSummaries.find((item) => item.providerId === cafe.id);
    return summary ? { ...cafe, internalId: summary.internalId, rating: summary.rating ?? undefined, ratingCount: summary.ratingCount } : cafe;
  }).filter((cafe) => !search.filterTopRated || (cafe.rating ?? 0) >= 4.5);

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6 pb-28 sm:px-6">
      <Link href="/map" className="inline-flex min-h-11 items-center text-sm font-medium text-accent underline">Return to map</Link>
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Nearby cafés</h1>
        <p className="mt-1 text-sm text-muted-foreground">From your last map search{search.query ? ` for “${search.query}”` : ""}. {search.filterTopRated && "Circle Top Rated filter is on."}</p>
      </div>
      {error && <div role="alert" className="space-y-2 text-sm text-foreground"><p>{error}</p><button type="button" onClick={() => void fetchCafes(search.query, search.coordinates)} className="min-h-11 rounded-xl border border-border bg-surface px-4 font-medium">Retry search</button></div>}
      {isLoading ? <ReadFeedback pending={isLoading} error={error} operationKey={`nearby:${accountId}:${JSON.stringify(search)}`} label="Loading cafés…" retry={() => fetchCafes(search.query, search.coordinates)}/> : <>
        <p role="status" className="text-sm text-muted-foreground">{results.length} cafés found</p>
        {results.length === 0 && !error && <p className="text-sm text-muted-foreground">No cafés match this search. Return to the map to choose another area or change filters.</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{results.map((cafe) => <CafeCard key={cafe.id} cafe={cafe} onSelect={setSelectedCafe} />)}</div>
      </>}
      <CafeDetailSheet cafe={selectedCafe} isOpen={Boolean(selectedCafe)} onClose={() => setSelectedCafe(null)} />
    </div>
  );
}
