"use client";
import { ReadFeedback } from "@/components/ui/read-feedback";

import { useEffect, useMemo, useRef, useState } from "react";
import { Coffee, Compass, Locate, Sparkles } from "lucide-react";
import { SearchBar } from "@/components/cafe/search-bar";
import { CafeFilters, sanitizeFilterKeys, type FilterKey } from "@/components/cafe/cafe-filters";
import { CafeCard } from "@/components/cafe/cafe-card";
import { CafeDetailSheet } from "@/components/cafe/cafe-detail-sheet";
import { useCafes } from "@/lib/hooks/use-cafes";
import { useLocalLocation } from "@/lib/hooks/use-local-location";
import { CAVITE_DEFAULT_COORDINATES } from "@/lib/hooks/use-location";
import { useCircle } from "@/lib/context/circle-context";
import { useNavigationState } from "@/lib/context/navigation-state";

export default function DiscoverPage() {
  const { accountId, circleCafeSummaries } = useCircle();
  const navigation = useNavigationState();
  const [restoredView] = useState(navigation.discover);
  const pageRef = useRef<HTMLDivElement>(null);
  const pendingLocateRef = useRef(false);
  const { coordinates, requestLocation, status, error: locationError } = useLocalLocation();
  const isLocating = status === "locating";
  const {
    cafes,
    query,
    setQuery,
    isLoading,
    selectedCafe,
    setSelectedCafe,
    fetchCafes,
    coords: searchCoordinates,
    error: searchError,
  } = useCafes({
    accountId,
    initialQuery: restoredView.query,
    initialCoords: restoredView.coordinates || coordinates || CAVITE_DEFAULT_COORDINATES,
  });

  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(() => new Set(sanitizeFilterKeys(restoredView.filters)));
  const latestView = useRef({ query, filters: [...activeFilters], coordinates: searchCoordinates });
  useEffect(() => {
    latestView.current = { query, filters: [...activeFilters], coordinates: searchCoordinates };
  }, [query, activeFilters, searchCoordinates]);

  useEffect(() => {
    const scroller = pageRef.current?.closest("main");
    if (scroller) scroller.scrollTop = restoredView.scrollTop;
    return () => {
      navigation.update({ discover: { ...latestView.current, scrollTop: scroller?.scrollTop || 0 } });
    };
    // Restore only when this page mounts; save the latest view on departure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pendingLocateRef.current && status === "ready" && coordinates) {
      pendingLocateRef.current = false;
      void fetchCafes(query, coordinates);
    }
  }, [coordinates, fetchCafes, query, status]);

  const handleToggleFilter = (filterKey: FilterKey) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filterKey)) {
        next.delete(filterKey);
      } else {
        next.add(filterKey);
      }
      return next;
    });
  };

  const filteredCafes = useMemo(() => {
    return cafes.map((cafe) => {
      const summary = circleCafeSummaries.find((item) => item.providerId === cafe.id);
      return summary ? { ...cafe, internalId: summary.internalId, rating: summary.rating ?? undefined, ratingCount: summary.ratingCount } : cafe;
    }).filter((cafe) => {
      if (activeFilters.has("topRated") && (cafe.rating || 0) < 4.5) {
        return false;
      }
      if (
        activeFilters.has("nearby") &&
        cafe.distanceMeters !== undefined &&
        cafe.distanceMeters > 3000
      ) {
        return false;
      }
      if (activeFilters.has("budget") && (cafe.priceLevel == null || cafe.priceLevel > 1)) {
        return false;
      }
      return true;
    });
  }, [cafes, activeFilters, circleCafeSummaries]);

  const handleUseLocation = () => {
    if (status === "ready" && coordinates) {
      fetchCafes(query, coordinates);
    } else {
      pendingLocateRef.current = true;
      requestLocation();
    }
  };

  return (
    <div ref={pageRef} className="mx-auto max-w-4xl px-4 pt-6 pb-28 sm:px-6 sm:pb-6 space-y-6">
      {(searchError || locationError) && <p role="status" className="text-sm text-muted-foreground">{searchError || locationError}</p>}
      {!coordinates && !restoredView.coordinates && <p className="text-xs text-muted-foreground">Browsing the default Cavite area. Tap Near Me for your location.</p>}
      {/* Top Header & Search Area */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="size-5 text-accent" />
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Discover Cafés
              </h1>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Find specialty roasteries and hidden coffee spots near you
            </p>
          </div>

          <button
            type="button"
            onClick={handleUseLocation}
            disabled={isLocating}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-accent hover:text-accent active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Locate className="size-3.5 text-accent" />
            <span className="hidden sm:inline">Near Me</span>
          </button>
        </div>

        {/* Search input */}
        <SearchBar
          value={query}
          onChange={setQuery}
          isLoading={isLoading}
        />

        {/* Filter chips */}
        <CafeFilters
          activeFilters={activeFilters}
          onToggleFilter={handleToggleFilter}
        />
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="font-semibold text-foreground">
            {filteredCafes.length} {filteredCafes.length === 1 ? "café" : "cafés"} found
          </span>
          {query && <span>for &ldquo;{query}&rdquo;</span>}
        </div>
      </div>

      {/* Loading Skeletons */}
      {isLoading && <ReadFeedback pending={isLoading} error={searchError} operationKey={`discover:${accountId}:${query}:${JSON.stringify(searchCoordinates)}`} label="Loading cafés…" retry={() => fetchCafes(query, searchCoordinates)}/>}

      {/* Results Grid */}
      {!isLoading && filteredCafes.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filteredCafes.map((cafe) => (
            <CafeCard
              key={cafe.id}
              cafe={cafe}
              onSelect={(selected) => setSelectedCafe(selected)}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredCafes.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border p-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-surface text-accent mb-4 border border-border">
            <Coffee className="size-7" />
          </div>
          <h3 className="text-base font-bold text-foreground">No cafés found</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Try adjusting your search query, clearing filters, or exploring a different city.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("coffee");
              setActiveFilters(new Set());
              fetchCafes("coffee", coordinates || undefined);
            }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-90 active:scale-95 cursor-pointer"
          >
            <Sparkles className="size-3.5" />
            <span>Reset Search</span>
          </button>
        </div>
      )}

      {/* Café Detail Sheet */}
      <CafeDetailSheet
        cafe={selectedCafe}
        isOpen={Boolean(selectedCafe)}
        onClose={() => setSelectedCafe(null)}
      />
    </div>
  );
}
