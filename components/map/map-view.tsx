"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NearbyListLink } from "@/components/discover/nearby-list-link";
import { ReadFeedback } from "@/components/ui/read-feedback";
import type { ReactNode } from "react";
import mapboxgl from "mapbox-gl";
import {
  Layers,
  Locate,
  MapPin,
  Navigation,
  Star,
} from "lucide-react";

import "mapbox-gl/dist/mapbox-gl.css";

import { useCircle } from "@/lib/context/circle-context";
import { useLocalLocation } from "@/lib/hooks/use-local-location";
import { useCafes } from "@/lib/hooks/use-cafes";
import { useNavigationState } from "@/lib/context/navigation-state";
import { cn } from "@/lib/utils";
import {
  createFlyToOptions,
  DEFAULT_MAP_CENTER,
  DEFAULT_ZOOM,
  getMapboxToken,
  hasMapboxConfig,
  MAPBOX_STYLES,
  type MapStyleKey,
} from "@/lib/services/map-service";
import { MapFallback } from "./map-fallback";
import { createCurrentUserMarkerElement } from "./member-avatar-marker";
import { createCafeMarkerElement } from "./cafe-marker";
import { CafeDetailSheet } from "@/components/cafe/cafe-detail-sheet";
import { CheckInModal } from "@/components/layout/check-in-modal";
import { CircleTopBar } from "@/components/layout/circle-top-bar";
import { CircleBottomSheet } from "@/components/layout/circle-bottom-sheet";
import { ActivityFeedSheet } from "@/components/feed/activity-feed-sheet";
import type { CafeSearchResult } from "@/lib/types/places";
import type { Activity } from "@/lib/types/social";
import { toast } from "sonner";
import { getCafeByReferenceAction } from "@/lib/actions/cafe-details-actions";

export type DiscoverySnapshot = {
 cafes: CafeSearchResult[]; initialLoading: boolean; refreshing: boolean; error: string | null; query: string; filterTopRated: boolean;
 onQueryChange(value: string): void; onTopRatedChange(value: boolean): void; onSearchSubmit(value: string): Promise<void>; onSearchArea(): Promise<void>; onNearMe(): void;
};
type MapViewProps = {
 floatingActionsTarget?: HTMLElement | null;
 onVisitOpen?: (cafe: CafeSearchResult) => void; shellMode?: boolean; onCafeOpen?: (cafe: CafeSearchResult) => void;
 onDiscoveryChange?: (snapshot: DiscoverySnapshot) => void;
 focusRequest?: { cafe: CafeSearchResult; sequence: number } | null;
 onSettingsOpen?: () => void; onCircleOpen?: () => void; onActivityOpen?: () => void;
 beforeCircleOpen?: () => boolean;
  initialCenter?: [number, number];
  initialZoom?: number;
  userAvatarUrl?: string | null;
};

const SEARCH_RADIUS_KM = 1.5;

// Helper to draw a precise real-world radius circle (without needing Turf.js)
function createGeoJSONCircle(center: [number, number], radiusInKm: number = SEARCH_RADIUS_KM, points: number = 64): {
  type: "Feature"; geometry: { type: "Polygon"; coordinates: number[][][] }; properties: Record<string, never>;
} {
  const coords = { latitude: center[1], longitude: center[0] };
  const ret = [];
  const distanceX = radiusInKm / (111.320 * Math.cos(coords.latitude * Math.PI / 180));
  const distanceY = radiusInKm / 110.574;

  let theta, x, y;
  for (let i = 0; i < points; i++) {
    theta = (i / points) * (2 * Math.PI);
    x = distanceX * Math.cos(theta);
    y = distanceY * Math.sin(theta);
    ret.push([coords.longitude + x, coords.latitude + y]);
  }
  ret.push(ret[0]);
  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [ret] },
    properties: {},
  };
}

function addRadiusLayers(map: mapboxgl.Map, center: [number, number]) {
  if (!map) return;
  if (map.getSource("search-radius")) return;

  map.addSource("search-radius", {
    type: "geojson",
    data: createGeoJSONCircle(center, SEARCH_RADIUS_KM),
  });

  map.addLayer({
    id: "search-radius-fill",
    type: "fill",
    source: "search-radius",
    paint: {
      "fill-color": "#211F1C",
      "fill-opacity": 0.4,
    },
  });

  map.addLayer({
    id: "search-radius-stroke",
    type: "line",
    source: "search-radius",
    paint: {
      "line-color": "#211F1C",
      "line-width": 2,
    },
  });
}

export function MapView({
  initialCenter = DEFAULT_MAP_CENTER,
  initialZoom = DEFAULT_ZOOM,
  userAvatarUrl, floatingActionsTarget, shellMode = false, onCafeOpen, onVisitOpen, onDiscoveryChange, focusRequest, onSettingsOpen, onCircleOpen, onActivityOpen, beforeCircleOpen,
}: MapViewProps) {
  const isConfigured = hasMapboxConfig();
  const navigation = useNavigationState();
  const { update: updateNavigation, getSnapshot: getNavigationSnapshot } = navigation;
  const [restoredView] = useState(navigation.map);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  
  // Dedicated user live marker
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  // Cafe marker cache
  const cafeMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());

  const [currentStyle, setCurrentStyle] = useState<MapStyleKey>(restoredView.style);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [styleLoading, setStyleLoading] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>(initialCenter);
  const [isDragging, setIsDragging] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const hasFlewToUserRef = useRef(Boolean(restoredView.searchCoordinates));
  const pendingLocateRef = useRef(false);

  // Circle state & Live GPS
  const { accountId, activeCircle, targetCoordinates, circleVisits, circleCafeSummaries } = useCircle();
  const activityScope = `${accountId}:${activeCircle?.id ?? ""}`;
  const currentActivityScope = useRef(activityScope);
  const activityRequest = useRef<symbol | null>(null);
  const activityAlive = useRef(true);
  const [activityLookup, setActivityLookup] = useState<{ scope: string; id: string } | null>(null);
  useLayoutEffect(() => { currentActivityScope.current = activityScope; }, [activityScope]);
  useEffect(() => { activityAlive.current = true; return () => { activityAlive.current = false; }; }, []);
  const { coordinates: myCoords, status: locationStatus, accuracyMeters, error: locationError, requestLocation } = useLocalLocation();
  const hasResolvedGps = locationStatus === "ready";

  // Modals & Sheets
  const [searchQuery, setSearchQueryState] = useState(restoredView.query);
  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
    updateNavigation({ map: { ...getNavigationSnapshot().map, query } });
  }, [updateNavigation, getNavigationSnapshot]);
  const [filterTopRated, setFilterTopRatedState] = useState(restoredView.filterTopRated ?? false);
  const setFilterTopRated = useCallback((value:boolean)=>{
    setFilterTopRatedState(value);
    updateNavigation({map:{...getNavigationSnapshot().map,filterTopRated:value}});
  },[updateNavigation,getNavigationSnapshot]);
  const { cafes: nearbyCafes, isLoading: isSearching, isRefreshing, error: searchError, fetchCafes, completedSearch, coords: searchCoordinates, query: pendingQuery } = useCafes({
    accountId,
    initialQuery: restoredView.query,
    initialCoords: restoredView.searchCoordinates || undefined,
    autoFetch: Boolean(restoredView.searchCoordinates),
    radiusMeters: SEARCH_RADIUS_KM * 1000,
  });
  const cafes = useMemo(() => {
    const mergedCafes = new Map<string, CafeSearchResult>(nearbyCafes.map((cafe) => [cafe.id, cafe]));
    for (const summary of circleCafeSummaries) {
    const discovered = mergedCafes.get(summary.providerId);
    mergedCafes.set(summary.providerId, {
      ...discovered,
      id: summary.providerId,
      internalId: summary.internalId,
      name: summary.name,
      address: discovered?.address || "Circle café",
      coordinates: summary.coordinates,
      rating: summary.rating ?? undefined,
      ratingCount: summary.ratingCount,
    });
    }
    return [...mergedCafes.values()];
  }, [nearbyCafes, circleCafeSummaries]);
  const [selectedCafe, setSelectedCafe] = useState<CafeSearchResult | null>(null);
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [isActivityFeedOpen, setIsActivityFeedOpen] = useState(false);

  // Search cafes around current area
  const searchCafes = useCallback(async (coords?: [number, number], queryOverride?: string) => {
    const q = (queryOverride !== undefined ? queryOverride : searchQuery).trim();
    await fetchCafes(q, coords);
    updateNavigation({ map: { ...getNavigationSnapshot().map, query: q, searchCoordinates: coords || null } });
  }, [fetchCafes, updateNavigation, getNavigationSnapshot, searchQuery]);

  // Calculate visual center directly under the pin (taking top bar & bottom sheet into account)
  const getVisualCenter = useCallback((): [number, number] => {
    const map = mapInstanceRef.current;
    const container = mapContainerRef.current;
    if (!map || !container) return initialCenter;
    const rect = container.getBoundingClientRect();
    const ratio = typeof window !== "undefined" && window.innerWidth < 640 ? 0.38 : 0.42;
    const pinPoint = map.unproject([rect.width * 0.5, rect.height * ratio]);
    return [pinPoint.lng, pinPoint.lat];
  }, [initialCenter]);

  // Offset for flyTo so targets land directly under the pin at ratio (38% on mobile)
  const getFlyToOffset = useCallback((): [number, number] => {
    if (typeof window === "undefined" || !mapContainerRef.current) return [0, 0];
    const rect = mapContainerRef.current.getBoundingClientRect();
    const ratio = window.innerWidth < 640 ? 0.38 : 0.42;
    return [0, (ratio - 0.5) * rect.height];
  }, []);

  // Handle activity tap: fly to cafe and open CafeDetailSheet
  const handleActivityTap = useCallback(
    async (activity: Activity) => {
      setIsActivityFeedOpen(false);

      if (!activity.cafe && !activity.cafe_id) return;

      const cafeObj = activity.cafe as (CafeSearchResult | undefined);
      if (cafeObj?.coordinates && mapInstanceRef.current) {
        mapInstanceRef.current.flyTo({
          ...createFlyToOptions(cafeObj.coordinates, 16),
          offset: getFlyToOffset(),
        });
        setSelectedCafe(cafeObj);
        return;
      }

      const existing = cafes.find(
        (c) => c.internalId === activity.cafe_id || c.id === activity.cafe_id || (activity.cafe && c.internalId === activity.cafe.id)
      );
      if (existing && mapInstanceRef.current) {
        mapInstanceRef.current.flyTo({
          ...createFlyToOptions(existing.coordinates, 16),
          offset: getFlyToOffset(),
        });
        setSelectedCafe(existing);
        return;
      }

      const cafeId = activity.cafe_id || activity.cafe?.id;
      if (cafeId) {
        const request = Symbol(cafeId);
        activityRequest.current = request;
        setActivityLookup({ scope: activityScope, id: cafeId });
        try {
          const cafeData = await getCafeByReferenceAction({ kind: "internal", id: cafeId }, accountId);
          if (!activityAlive.current || activityRequest.current !== request || currentActivityScope.current !== activityScope) return;
            if (cafeData && cafeData.coordinates && mapInstanceRef.current) {
              mapInstanceRef.current.flyTo({
                ...createFlyToOptions(cafeData.coordinates, 16),
                offset: getFlyToOffset(),
              });
              setSelectedCafe(cafeData);
              return;
            }
        } catch {
          if (activityAlive.current && activityRequest.current === request && currentActivityScope.current === activityScope) toast.error("Could not load that café. Please try again.");
        } finally {
          if (activityAlive.current && activityRequest.current === request) setActivityLookup(null);
        }
      }
    },
    [cafes, getFlyToOffset, accountId, activityScope]
  );

  // Initialize Mapbox map
  useEffect(() => {
    if (!isConfigured || !mapContainerRef.current || mapInstanceRef.current) {
      return;
    }

    const markersMap = cafeMarkersRef.current;
    let disposed = false;
    let moveRafId: number | null = null;

    try {
      mapboxgl.accessToken = getMapboxToken();

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: MAPBOX_STYLES[currentStyle],
        center: restoredView.searchCoordinates ? restoredView.center : (myCoords || initialCenter),
        zoom: restoredView.searchCoordinates ? restoredView.zoom : initialZoom,
        attributionControl: false,
      });

      mapInstanceRef.current = map;

      map.on("load", () => {
        if (disposed) return;
        setMapLoaded(true);
        // Position initial center directly under the pin at 38%
        if (!restoredView.searchCoordinates) map.easeTo({
          center: myCoords || initialCenter,
          offset: getFlyToOffset(),
          duration: 0,
        });
        const centerCoord = getVisualCenter();
        setMapCenter(centerCoord);
        if (!restoredView.searchCoordinates) searchCafes(centerCoord);
        const source = map.getSource("search-radius") as mapboxgl.GeoJSONSource;
        if (source) {
          source.setData(createGeoJSONCircle(centerCoord, SEARCH_RADIUS_KM));
        }
      });

      // Add radius layers on initial load AND after every style switch
      // (style.load fires for both cases, so a single listener is sufficient)
      map.on("style.load", () => {
        if (disposed) return;
        setStyleLoading(false);
        const centerCoord = getVisualCenter();
        addRadiusLayers(map, centerCoord);
        const source = map.getSource("search-radius") as mapboxgl.GeoJSONSource;
        if (source) {
          source.setData(createGeoJSONCircle(centerCoord, SEARCH_RADIUS_KM));
        }
      });

      map.on("dragstart", () => setIsDragging(true));
      map.on("dragend", () => setIsDragging(false));
      map.on("movestart", () => setIsDragging(true));
      map.on("moveend", () => {
        if (disposed) return;
        setIsDragging(false);
        setMapCenter(getVisualCenter());
        const center = map.getCenter();
        updateNavigation({ map: { ...getNavigationSnapshot().map, center: [center.lng, center.lat], zoom: map.getZoom() } });
      });

      map.on("move", () => {
        if (disposed) return;
        const newCenter = getVisualCenter();
        // Throttle GeoJSON circle updates to one per animation frame
        if (moveRafId !== null) cancelAnimationFrame(moveRafId);
        moveRafId = requestAnimationFrame(() => {
          moveRafId = null;
          if (disposed || mapInstanceRef.current !== map) return;
          const source = map.getSource("search-radius") as mapboxgl.GeoJSONSource;
          if (source) {
            source.setData(createGeoJSONCircle(newCenter, SEARCH_RADIUS_KM));
          }
        });
      });

      map.on("error", (e) => {
        if (e.error?.message?.includes("token")) {
          setMapError("Invalid Mapbox token. Check your environment settings.");
        }
      });
    } catch {
      queueMicrotask(() => setMapError("Failed to load map."));
    }

    return () => {
      disposed = true;
      if (moveRafId !== null) cancelAnimationFrame(moveRafId);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        userMarkerRef.current = null;
        markersMap.clear();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCenter, initialZoom, isConfigured]);

  // Handle Style Switching
  const handleStyleChange = (styleKey: MapStyleKey) => {
    if (!mapInstanceRef.current) return;
    if (styleKey === currentStyle) return;
    setStyleLoading(true);
    setCurrentStyle(styleKey);
    updateNavigation({ map: { ...getNavigationSnapshot().map, style: styleKey } });
    mapInstanceRef.current.setStyle(MAPBOX_STYLES[styleKey]);
  };

  // Fly to target coordinate from CircleContext (when user clicks Locate Member)
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded || !targetCoordinates) return;
    mapInstanceRef.current.flyTo({
      ...createFlyToOptions(targetCoordinates, 16),
      offset: getFlyToOffset(),
    });
  }, [getFlyToOffset, mapLoaded, targetCoordinates]);

  // Fly to user's initial GPS location once acquired
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded || !hasResolvedGps || (hasFlewToUserRef.current && !pendingLocateRef.current)) {
      return;
    }
    hasFlewToUserRef.current = true;
    pendingLocateRef.current = false;
    if (myCoords) {
      mapInstanceRef.current.flyTo({
        ...createFlyToOptions(myCoords, 15),
        offset: getFlyToOffset(),
      });
      searchCafes(myCoords);
    }
  }, [getFlyToOffset, hasResolvedGps, mapLoaded, myCoords, searchCafes]);

  // Render / Update User's Own Live Marker instantly whenever myCoords changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded) return;
    if (!myCoords) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }

    if (!userMarkerRef.current) {
      const el = createCurrentUserMarkerElement();

      userMarkerRef.current = new mapboxgl.Marker({
        element: el,
        anchor: "center",
      })
        .setLngLat(myCoords)
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat(myCoords);
    }
    userMarkerRef.current.getElement().style.opacity = hasResolvedGps ? "1" : "0.45";
  }, [mapLoaded, myCoords, hasResolvedGps]);

  // Update Cafe Markers on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded) return;

    // Clear old cafe markers
    cafeMarkersRef.current.forEach((marker) => marker.remove());
    cafeMarkersRef.current.clear();

    const visitedCafeIds = new Set(circleVisits.map((v) => v.cafe_id));
    
    // Apply top-rated filter if enabled
    const displayedCafes = filterTopRated
      ? cafes.filter((c) => (c.rating || 0) >= 4.5)
      : cafes;

    displayedCafes.forEach((cafe) => {
      const isVisited = Boolean(cafe.internalId && visitedCafeIds.has(cafe.internalId));
      const el = createCafeMarkerElement(cafe, isVisited, () => {
        if (shellMode) onCafeOpen?.(cafe); else setSelectedCafe(cafe);
        if (!shellMode) map.flyTo(createFlyToOptions([cafe.coordinates[0], cafe.coordinates[1]], 16));
      });

      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([cafe.coordinates[0], cafe.coordinates[1]])
        .addTo(map);

      cafeMarkersRef.current.set(cafe.id, marker);
    });
  }, [cafes, circleVisits, filterTopRated, mapLoaded, shellMode, onCafeOpen]);

  // Recenter to current user's GPS
  const recenterSelf = () => {
    if (!hasResolvedGps || !myCoords) {
      pendingLocateRef.current = true;
      requestLocation();
      toast.info(locationStatus === "denied" ? "Allow location access, then retry." : "Getting a fresh location...");
      return;
    }
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo({
      ...createFlyToOptions(myCoords, 16),
      offset: getFlyToOffset(),
    });
  };

  const nearMe = useCallback(() => {
    if (hasResolvedGps && myCoords) {
      mapInstanceRef.current?.flyTo({ ...createFlyToOptions(myCoords, 15), offset: getFlyToOffset() });
      void searchCafes(myCoords);
    } else { pendingLocateRef.current = true; requestLocation(); toast.info("Getting a fresh location..."); }
  }, [hasResolvedGps, myCoords, getFlyToOffset, searchCafes, requestLocation]);
  const searchSubmit = useCallback((value: string) => searchCafes(mapCenter, value), [mapCenter, searchCafes]);
  const searchArea = useCallback(() => searchCafes(mapCenter), [mapCenter, searchCafes]);
  useEffect(() => { onDiscoveryChange?.({ cafes, initialLoading: isSearching, refreshing: isRefreshing, error: searchError, query: searchQuery, filterTopRated, onQueryChange: setSearchQuery, onTopRatedChange: setFilterTopRated, onSearchSubmit: searchSubmit, onSearchArea: searchArea, onNearMe: nearMe }); }, [cafes, isSearching, isRefreshing, searchError, searchQuery, filterTopRated, setSearchQuery, setFilterTopRated, searchSubmit, searchArea, nearMe, onDiscoveryChange]);
  const lastFocusSequence = useRef(0);
  useEffect(() => {
    if (!focusRequest || lastFocusSequence.current === focusRequest.sequence || !mapLoaded) return;
    lastFocusSequence.current = focusRequest.sequence;
    mapInstanceRef.current?.flyTo({ ...createFlyToOptions(focusRequest.cafe.coordinates, 16), offset: getFlyToOffset() });
  }, [focusRequest, mapLoaded, getFlyToOffset]);
  const floatingActions: ReactNode = (
          <div className="pointer-events-none flex w-full items-center justify-between">
            {/* Left: Quick Check-in */}
            <div className="pointer-events-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCheckInOpen(true)}
                className="group flex items-center gap-2 rounded-full border border-border/80 bg-surface/95 px-4 py-2.5 text-xs font-bold font-display text-foreground shadow-lg backdrop-blur-md transition-all hover:scale-105 active:scale-95 hover:border-accent cursor-pointer"
              >
                <div className="flex size-5 items-center justify-center rounded-full bg-accent text-accent-foreground transition-transform group-hover:scale-110">
                  <MapPin className="size-3" />
                </div>
                <span>Check in</span>
              </button>
            </div>

            {/* Right: Map Style & Recenter Controls */}
            <div className="pointer-events-auto flex items-center gap-2">
              {/* Map Style Toggle */}
              <button
                type="button"
                onClick={() =>
                  handleStyleChange(
                    currentStyle === "satellite"
                      ? "dark"
                      : currentStyle === "dark"
                      ? "streets"
                      : "satellite"
                  )
                }
                title="Toggle Map Style"
                aria-label="Toggle Map Style"
                className="flex size-11 items-center justify-center rounded-full border border-border/80 bg-surface/95 text-foreground shadow-lg backdrop-blur-md transition-all hover:scale-105 active:scale-95 hover:border-accent hover:text-accent cursor-pointer"
              >
                <Layers className="size-5 text-accent" />
              </button>

              {/* Recenter GPS */}
              <button
                type="button"
                onClick={recenterSelf}
                title="Center on My Location"
                aria-label="Center on My Location"
                className="flex size-11 items-center justify-center rounded-full border border-border/80 bg-surface/95 text-foreground shadow-lg backdrop-blur-md transition-all hover:scale-105 active:scale-95 hover:border-accent cursor-pointer"
              >
                <Navigation className="size-5 text-accent fill-accent" />
              </button>
            </div>
          </div>
  );
  if (!isConfigured || mapError) {
    return <MapFallback message={mapError || "Map configuration missing."} />;
  }

  return (
    <div className="relative h-full w-full overflow-hidden select-none">
      <div ref={mapContainerRef} className="h-full w-full" />
      {activityLookup?.scope === activityScope && <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4"><ReadFeedback pending operationKey={`activity-cafe:${activityScope}:${activityLookup.id}`} label="Loading café…" className="pointer-events-auto max-w-sm rounded-xl border border-border bg-background p-4" /></div>}
      {(!mapLoaded || styleLoading) && <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
        <ReadFeedback pending operationKey={`map:${accountId}:${currentStyle}`} label={mapLoaded ? "Loading map style…" : "Loading map…"} className="pointer-events-auto max-w-sm rounded-xl border border-border bg-background p-4" />
      </div>}

      {/* Fixed Center Search Pin (Vertically centered in visible map area) */}
      <div className="pointer-events-none absolute left-1/2 top-[38%] sm:top-[42%] z-10">
        <div className="relative flex flex-col items-center -translate-x-1/2 -translate-y-full">
          {/* Teardrop Dark Roast Pointer */}
          <div
            className={cn(
              "transition-all duration-200 ease-out flex flex-col items-center",
              isDragging ? "-translate-y-2 scale-110" : "-translate-y-0 scale-100"
            )}
          >
            <svg
              width="26"
              height="36"
              viewBox="0 0 26 36"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="drop-shadow-[0_6px_14px_rgba(0,0,0,0.65)]"
            >
              <path
                d="M13 1C6.37 1 1 6.37 1 13C1 21.4 11.2 32.8 12.3 34.2C12.7 34.6 13.3 34.6 13.7 34.2C14.8 32.8 25 21.4 25 13C25 6.37 19.63 1 13 1Z"
                fill="#1C1A18"
                stroke="#F5F3EF"
                strokeWidth="1.75"
              />
              <circle cx="13" cy="13" r="3.75" fill="#F5F3EF" />
            </svg>
          </div>

          {/* Dynamic Ground Shadow */}
          <div
            className={cn(
              "rounded-full bg-black/45 blur-[1.5px] transition-all duration-200",
              isDragging ? "h-1 w-3 opacity-30 mt-2.5 scale-75" : "h-1.5 w-2 opacity-75 mt-0.5 scale-100"
            )}
          />
        </div>
      </div>



      {/* Circle Top Bar with Smooth Expandable Search */}
      <CircleTopBar
        rightAction={<NearbyListLink search={completedSearch ?? null} filterTopRated={filterTopRated} iconOnly/>}
        userAvatarUrl={userAvatarUrl}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={(q) => searchCafes(mapCenter, q)}
        isSearching={isSearching}
        cafeCount={cafes.length}
        onActivityOpen={shellMode ? onActivityOpen : () => setIsActivityFeedOpen(true)}
        onSettingsOpen={onSettingsOpen}
        onCircleOpen={onCircleOpen}
        beforeCircleOpen={beforeCircleOpen}
      />

      {/* Quick Filter & Action Chips Overlay (Floats cleanly below Top Bar) */}
      <div className="pointer-events-none absolute top-[calc(env(safe-area-inset-top)_+_4.125rem)] sm:top-[calc(env(safe-area-inset-top)_+_4.5rem)] inset-x-0 z-20 flex flex-col items-center gap-1.5 px-3">
        {/* Quick Filter & Action Chips */}
        <div aria-label="Map actions" className="pointer-events-auto flex max-w-full flex-nowrap items-center justify-center gap-1 py-1 [&>button]:min-h-11 [&>button]:whitespace-nowrap [&>button]:gap-1 [&>button]:px-0.5 [&>button]:text-[11px] min-[360px]:[&>button]:px-1.5 min-[390px]:[&>button]:px-2.5 min-[390px]:[&>button]:text-xs [&>button>svg]:size-3 [&>button>svg]:shrink-0">
          {/* Near Me */}
          <button
            type="button"
            onClick={() => {
              if (hasResolvedGps && myCoords) {
                mapInstanceRef.current?.flyTo({
                  ...createFlyToOptions(myCoords, 15),
                  offset: getFlyToOffset(),
                });
                searchCafes(myCoords);
              } else {
                pendingLocateRef.current = true;
                requestLocation();
                toast.info("Getting a fresh location...");
              }
            }}
            className="flex shrink-0 items-center rounded-full border border-border/80 bg-surface/90 py-1.5 font-semibold text-foreground shadow-sm backdrop-blur-md transition-colors hover:border-accent active:scale-95 cursor-pointer"
          >
            <Locate className="size-3.5 text-accent" />
            Near Me
          </button>

          {/* Top Rated (4.5+) */}
          <button
            type="button"
            onClick={() => setFilterTopRated(!filterTopRated)}
            className={`flex shrink-0 items-center rounded-full border py-1.5 font-semibold shadow-sm backdrop-blur-md transition-colors active:scale-95 cursor-pointer ${
              filterTopRated
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border/80 bg-surface/90 text-foreground hover:border-accent"
            }`}
          >
            <Star className={`size-3.5 ${filterTopRated ? "fill-white" : "text-amber-500 fill-amber-500"}`} />
            Circle Top Rated
          </button>

          {/* Search Selected Area */}
          <button
            type="button"
            onClick={() => searchCafes(mapCenter)}
            className="flex shrink-0 items-center rounded-full border border-border/80 bg-surface/90 py-1.5 font-semibold text-foreground shadow-sm backdrop-blur-md transition-colors hover:border-accent active:scale-95 cursor-pointer"
          >
            <MapPin className="size-3.5 text-accent" />
            Search this area
          </button>
        </div>

        {/* Empty state guidance */}
        {(locationError || locationStatus === "stale") && (
          <p role="status" className="pointer-events-auto rounded-xl bg-surface px-3 py-2 text-xs text-foreground shadow-sm">
            {locationError || "Showing your last known location. Tap Near Me to refresh."}
          </p>
        )}
        {accuracyMeters !== null && hasResolvedGps && (
          <p className="rounded-full bg-surface/95 px-3 py-1 text-xs text-muted-foreground">Location accuracy about ±{Math.round(accuracyMeters)} m</p>
        )}
        {(isSearching || searchError) && <ReadFeedback pending={isSearching && !searchError} error={searchError} operationKey={`search:${accountId}:${pendingQuery}:${searchCoordinates?.join(",")}`} label="Loading cafés…" retry={() => searchCafes(searchCoordinates ?? mapCenter, pendingQuery ?? searchQuery)} className="pointer-events-auto max-w-sm rounded-xl border border-border bg-background p-3" />}
        {locationStatus === "locating" && <ReadFeedback pending operationKey={`location:${accountId}`} label="Finding your location…" retry={requestLocation} className="pointer-events-auto max-w-sm rounded-xl border border-border bg-background p-3" />}
        {isRefreshing && <span role="status" className="rounded-full bg-surface px-3 py-1 text-xs text-muted-foreground">Updating cafés…</span>}
        {cafes.length === 0 && !isSearching && !searchError && mapLoaded && (
          <div className="pointer-events-auto mt-1 flex items-center gap-2 rounded-2xl border border-border/60 bg-surface/95 px-4 py-2 text-xs text-muted-foreground shadow-lg backdrop-blur-md animate-in fade-in duration-200">
            <span>No cafés found here. Drag the map to explore or tap <strong>Near Me</strong>!</span>
          </div>
        )}
      </div>

      {/* Cafe Detail Sheet */}
      {!shellMode && <>
      <CafeDetailSheet
        cafe={selectedCafe}
        isOpen={Boolean(selectedCafe)}
        onClose={() => setSelectedCafe(null)}
      />

      {/* Activity Feed Sheet */}
      <ActivityFeedSheet
        isOpen={isActivityFeedOpen}
        onClose={() => setIsActivityFeedOpen(false)}
        onActivityTap={handleActivityTap}
      />

      </>}
      {/* Check-In Modal */}
      <CheckInModal
        isOpen={isCheckInOpen}
        onClose={() => setIsCheckInOpen(false)}
        onChooseCafe={shellMode ? onVisitOpen : undefined}
        nearbyCafes={cafes}
        userCoordinates={mapCenter}
      />

      {shellMode ? floatingActionsTarget && createPortal(floatingActions, floatingActionsTarget) : <CircleBottomSheet floatingActions={floatingActions}/>}
    </div>
  );
}
