"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { toast } from "sonner";
import {
  Clock,
  Coffee,
  FolderPlus,
  MapPin,
  Navigation,
  Share2,
  Star,
} from "lucide-react";
import type { SheetRoute } from "@/lib/navigation/sheet-routes";
import { BottomSheet } from "@/components/layout/bottom-sheet";
import { GroupRelationship } from "./group-relationship";
import {
  toggleSaveCafeAction,
} from "@/lib/actions/cafe-actions";
import { CafePhotos } from "./cafe-photos";
import { InterestButton } from "./interest-button";
import { CollectionPicker } from "./collection-picker";
import { SaveButton } from "./save-button";
import { CircleSaveButton } from "./circle-save-button";
import { VisitTimelineFetcher } from "@/components/visit/visit-timeline-fetcher";
import { LogVisitForm } from "@/components/visit/log-visit-form";
import { CafeHoursSection } from "./cafe-hours-section";
import { useCircle } from "@/lib/context/circle-context";
import { isCurrentlyOpen, type CafeHoursEntry } from "@/lib/utils/cafe-hours";
import type { CafeSearchResult } from "@/lib/types/places";
import { useSWRConfig } from "swr";
import { isCafeSaveMutationKey } from "@/lib/hooks/use-saved-cafes";
import { isOnline, OFFLINE_MUTATION_MESSAGE } from "@/lib/hooks/use-online-status";

export type CafeDetailContentProps = {
  cafe: CafeSearchResult | null;
  onOpen?: (route: SheetRoute) => void;
  active?: boolean;
  onSave?: (cafe: CafeSearchResult) => void;
  initialIsSaved?: boolean;
  initialCollection?: string;
  onSaveStateChange?: (cafeId: string, isSaved: boolean, collection?: string) => void;
};

export function CafeDetailContent({
  cafe,
  onOpen,
  active = true,
  onSave,
  initialIsSaved,
  initialCollection,
  onSaveStateChange,
}: CafeDetailContentProps) {
  const { accountId, activeCircle, circleCafeSummaries } = useCircle();
  const { mutate } = useSWRConfig();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [sharingScope, setSharingScope] = useState<string | null>(null);
  const [isLogVisitOpen, setIsLogVisitOpen] = useState(false);
  const logVisitDirty = useRef(false);
  const handleLogVisitDirty = useCallback((dirty: boolean) => { logVisitDirty.current = dirty; }, []);
  const closeLogVisit = useCallback(() => {
    if (!logVisitDirty.current || window.confirm("Discard your unsaved changes?")) {
      logVisitDirty.current = false;
      setIsLogVisitOpen(false);
    }
  }, []);
  useEffect(() => {
    if (!isLogVisitOpen) return;
    const unload = (event: BeforeUnloadEvent) => {
      if (!logVisitDirty.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [isLogVisitOpen]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const effectiveCollection = selectedCollection ?? initialCollection ?? "Favorites";
  const [hoursState, setHoursState] = useState<{ key: string; hours: CafeHoursEntry[] }>({ key: "", hours: [] });
  const [hoursErrorState, setHoursErrorState] = useState<{ key: string; error: string | null }>({ key: "", error: null });

  // Keep last active cafe so that the sheet can animate out smoothly when closing
  const [displayedCafe, setDisplayedCafe] = useState<CafeSearchResult | null>(cafe);

  if (cafe && cafe !== displayedCafe) {
    setDisplayedCafe(cafe);
    setSelectedCollection(null);
  }

  const activeCafe = cafe || displayedCafe;
  const saveScope = `${accountId}:${activeCafe?.id ?? ""}`;
  const saveGeneration = useRef<{ scope: string } | null>({ scope: saveScope });
  useLayoutEffect(() => {
    saveGeneration.current = { scope: saveScope };
    return () => { saveGeneration.current = null; };
  }, [saveScope]);
  const hoursKey = `${activeCircle?.id ?? ""}:${activeCafe?.id ?? ""}`;
  const latestHoursKey = useRef(hoursKey);
  useEffect(() => { latestHoursKey.current = hoursKey; }, [hoursKey]);
  const circleHours = hoursState.key === hoursKey ? hoursState.hours : [];
  const hoursError = hoursErrorState.key === hoursKey ? hoursErrorState.error : null;
  const timezone = circleHours[0]?.timezone || "Asia/Manila";
  const hoursStatus = isCurrentlyOpen(circleHours, timezone);
  const handleHoursChange = useCallback((hours: CafeHoursEntry[]) => {
    if (latestHoursKey.current === hoursKey) {
      setHoursState({ key: hoursKey, hours });
      setHoursErrorState({ key: hoursKey, error: null });
    }
  }, [hoursKey]);
  const handleHoursError = useCallback((error: string | null) => {
    if (latestHoursKey.current === hoursKey) {
      setHoursErrorState({ key: hoursKey, error });
    }
  }, [hoursKey]);

  if (!activeCafe) return null;

  const cafeSummary = circleCafeSummaries.find(
    (item) => item.internalId === activeCafe.id || item.providerId === activeCafe.id,
  );
  const displayRating = cafeSummary?.rating ?? null;
  const displayRatingCount = cafeSummary?.ratingCount ?? 0;
  const shareScope = `${accountId}:${activeCafe.id}`;
  const isSharing = sharingScope === shareScope;

  const handleGetDirections = () => {
    const [lng, lat] = activeCafe.coordinates;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      "_blank",
    );
  };

  const handleShare = async () => {
    if (isSharing) return;
    setSharingScope(shareScope);
    try {
      if (navigator.share) {
        await navigator.share({
          title: activeCafe.name,
          text: `Check out ${activeCafe.name} on Cafe360!`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied to clipboard!");
      }
    } catch (cause) {
      if (!(typeof cause === "object" && cause !== null && "name" in cause && cause.name === "AbortError")) {
        toast.error("Could not share this café. Please try again.");
      }
    } finally {
      setSharingScope(current => current === shareScope ? null : current);
    }
  };

  const handleSelectCollection = async (selectedCol: string, notes?: string) => {
    if (!isOnline()) throw new Error(OFFLINE_MUTATION_MESSAGE);
    const generation = saveGeneration.current;
    const result = await toggleSaveCafeAction({
      cafe: activeCafe,
      collection: selectedCol,
      notes,
      isSaving: true,
      expectedAccountId: accountId,
    });
    if (!result.success) throw new Error(result.error || "Could not save café. Please retry.");
    void mutate((key) => isCafeSaveMutationKey(key, accountId, activeCafe.id), undefined, { revalidate: true }).catch(() => undefined);
    if (saveGeneration.current !== generation) return;
    setSelectedCollection(selectedCol);
    onSave?.(activeCafe);
    onSaveStateChange?.(activeCafe.id, true, selectedCol);
  };

  return (
    <>
      <div className="space-y-6 pb-6">
        {/* Café Photos */}
        <CafePhotos cafeId={activeCafe.id} cafeName={activeCafe.name} photos={activeCafe.photoUrl ? [activeCafe.photoUrl] : []} />

        {/* Café Title & Overview */}
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                {activeCafe.name}
              </h2>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                <MapPin className="size-3.5 text-accent shrink-0" />
                <span>{activeCafe.address}</span>
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300">
              <Star className="size-3.5 fill-amber-400 text-amber-400" />
              <span>{displayRating !== null && displayRating !== undefined ? displayRating.toFixed(1) : "New"}</span>
              <span className="font-normal text-muted-foreground">
                {displayRatingCount > 0
                  ? `(${displayRatingCount} ${displayRatingCount === 1 ? "review" : "reviews"})`
                  : "(No reviews yet)"}
              </span>
            </span>

            {activeCafe.priceLevel != null && <span className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-mono text-muted-foreground">
              {"$".repeat(activeCafe.priceLevel)}
            </span>}

            {hoursStatus === "closed" ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-400">
                <span className="size-1.5 rounded-full bg-rose-400" />
                <span>Closed Now</span>
              </span>
            ) : hoursStatus === "open" ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Open Now</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <Clock className="size-3.5" />
                <span>{hoursError ? "Hours unavailable" : "Hours unknown"}</span>
              </span>
            )}
          </div>
        </div>

        {/* I'm Interested Action */}
        <div className="mt-1">
          <InterestButton cafe={activeCafe} />
        </div>

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-5 gap-2">
          <SaveButton
            cafe={activeCafe}
            variant="sheet-action"
            initialIsSaved={initialIsSaved}
            collection={effectiveCollection}
            onSaveStateChange={(isSaved, col) => {
              if (col) setSelectedCollection(col);
              if (isSaved) {
                onSave?.(activeCafe);
              }
              onSaveStateChange?.(activeCafe.id, isSaved, col);
            }}
          />

          <button
            type="button"
            onClick={() => onOpen ? onOpen({ kind: "visit", root: "nearby", entityId: activeCafe.id, circleId: activeCircle?.id }) : setIsLogVisitOpen(true)}
            className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-background/60 p-3 text-xs font-medium text-foreground transition-all hover:border-accent/40 active:scale-95 cursor-pointer"
          >
            <Coffee className="size-4 text-accent" />
            <span>Log</span>
          </button>

          <button
            type="button"
            onClick={handleGetDirections}
            className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-background/60 p-3 text-xs font-medium text-foreground transition-all hover:border-accent/40 active:scale-95 cursor-pointer"
          >
            <Navigation className="size-4 text-accent" />
            <span>Go</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPickerOpen(true)}
            className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-background/60 p-3 text-xs font-medium text-foreground transition-all hover:border-accent/40 active:scale-95 cursor-pointer"
          >
            <FolderPlus className="size-4 text-accent" />
            <span>Organize</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            disabled={isSharing}
            className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-background/60 p-3 text-xs font-medium text-foreground transition-all hover:border-accent/40 active:scale-95 cursor-pointer"
          >
            <Share2 className="size-4 text-accent" />
            <span>Share</span>
          </button>
        </div>

        <ActionFeedback pending={isSharing} operationKey={`cafe-share:${shareScope}`} label="Sharing café…" />
        <CircleSaveButton cafe={activeCafe} />

        {/* Operating Hours (Circle-scoped) */}
        <CafeHoursSection
          cafe={activeCafe}
          isOpen={active}
          onHoursChange={handleHoursChange}
          onHoursError={handleHoursError}
        />

        {/* Categories / Tags */}
        {activeCafe.categories && activeCafe.categories.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">
              Features & Vibe
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {activeCafe.categories.map((cat) => (
                <span
                  key={cat}
                  className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground capitalize"
                >
                  {cat}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Circle Connection / Group Relationship */}
        <GroupRelationship cafeId={activeCafe.id} />

        {/* Visit Timeline */}
        <div className="pt-4 border-t border-border/50">
          <h4 className="font-bold text-foreground mb-3">Memories & Visits</h4>
          {onOpen && activeCircle && <button className="min-h-11 underline" onClick={() => onOpen({kind:"cafe-memories",root:"nearby",entityId:activeCafe.id,circleId:activeCircle.id})}>View all memories</button>}
          <VisitTimelineFetcher cafeId={activeCafe.id} groupId={activeCircle?.id || null} onOpen={onOpen} />
        </div>
      </div>

      {/* Organize Collection Modal */}
      <CollectionPicker
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        selectedCollection={effectiveCollection}
        onSelectCollection={handleSelectCollection}
        cafeName={activeCafe.name}
      />

      {/* Log Visit Modal */}
      {!onOpen && <BottomSheet
        isOpen={isLogVisitOpen}
        onClose={closeLogVisit}
        title="Log Visit"
        snapPoint="full"
      >
        <div className="px-4 pb-8">
          <LogVisitForm
            cafe={activeCafe}
            onSuccess={() => { logVisitDirty.current = false; setIsLogVisitOpen(false); }}
            onDirtyChange={handleLogVisitDirty}
          />
        </div>
      </BottomSheet>}
    </>
  );
}
