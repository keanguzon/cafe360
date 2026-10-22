"use client";
import { ReadFeedback } from "@/components/ui/read-feedback";

import { useState } from "react";
import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { ArrowLeft, BookmarkCheck, Coffee, Compass, MapPin, StickyNote } from "lucide-react";
import { CafeDetailSheet } from "./cafe-detail-sheet";
import { SaveButton } from "./save-button";
import type { CafeSearchResult } from "@/lib/types/places";
import { useCircle } from "@/lib/context/circle-context";
import { useSavedCafes } from "@/lib/hooks/use-saved-cafes";

import type { SheetRoute } from "@/lib/navigation/sheet-routes";

type CollectionViewProps = {
  presentation?: "page" | "sheet";
  onOpen?: (route: SheetRoute) => void;
  onBack?: () => void;
  active?: boolean;
  collectionName: string;
};

export function CollectionView({ collectionName, presentation = "page", onOpen, onBack, active = true }: CollectionViewProps) {
  const { accountId, activeCircle } = useCircle();
  const { savedCafes, initialLoading, error, refresh } = useSavedCafes(accountId, collectionName, active);
  const [selectedCafe, setSelectedCafe] = useState<CafeSearchResult | null>(null);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);

  const handleSelectCafe = (cafe: CafeSearchResult) => {
    if (presentation === "sheet" && onOpen) { if (!activeCircle) { alert("Select a Circle to open this café."); return; } onOpen({kind: "cafe", root: "saved", entityId: cafe.id, circleId: activeCircle.id}); return; }
    setSelectedCafe(cafe);
    setIsDetailSheetOpen(true);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 pt-6 pb-28 sm:px-6 sm:py-10">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/profile/collections"
            aria-label="Back to collections"
            onClick={e => { if(presentation === "sheet" && onBack) {e.preventDefault();onBack();} }}
            className="flex size-9 items-center justify-center rounded-xl border border-border bg-surface text-muted-foreground hover:border-accent hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
                Collection
              </span>
              <span className="text-xs text-muted-foreground">
                {savedCafes.length} {savedCafes.length === 1 ? "café" : "cafés"}
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {collectionName}
            </h1>
          </div>
        </div>

        <Link
          href="/map"
          onClick={e=>{if(presentation === "sheet" && onOpen && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey){e.preventDefault();onOpen({kind:"nearby",root:"nearby"});}}}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 py-2 text-xs font-semibold text-foreground hover:border-accent transition-colors"
        >
          <Compass className="size-4 text-accent" />
          <span>Add More</span>
        </Link>
      </div>

      {error && <div role="alert" className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive">{error} <button type="button" onClick={() => { void refresh(); }} className="underline">Try again</button></div>}
      {initialLoading ? <ReadFeedback pending={active && initialLoading} error={error} operationKey={`saved:${accountId}:${collectionName}`} label="Loading saved cafés…" retry={refresh} className="py-12"/> : savedCafes.length === 0 && !error ? (
        <div className="rounded-3xl border border-dashed border-border p-12 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent/15 text-accent border border-accent/20">
            <Coffee className="size-7" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-foreground">
            This collection is empty
          </h3>
          <p className="mx-auto mt-1.5 max-w-sm text-xs text-muted-foreground">
            Explore cafés on the map and save your favorite spots directly to &ldquo;{collectionName}&rdquo;.
          </p>
          <div className="mt-6">
            <Link
              href="/map"
          onClick={e=>{if(presentation === "sheet" && onOpen && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey){e.preventDefault();onOpen({kind:"nearby",root:"nearby"});}}}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-xs font-semibold text-accent-foreground shadow-md hover:brightness-110 transition-all"
            >
              <Compass className="size-4" />
              Discover Cafés
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {savedCafes.map((item) => {
            if (!item.cafe) return null;
            const cafe = item.cafe;

            return (
              <div
                key={item.id}
                onClick={() => handleSelectCafe(cafe)}
                className="group relative flex flex-col justify-between rounded-3xl border border-border/80 bg-surface/80 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:bg-surface hover:shadow-lg cursor-pointer"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent border border-accent/20">
                        <Coffee className="size-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-foreground group-hover:text-accent transition-colors line-clamp-1">
                          <Link href={`/cafes/${encodeURIComponent(cafe.id)}`} onClick={event => { event.stopPropagation(); if(event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {event.preventDefault();handleSelectCafe(cafe);} }}>{cafe.name}</Link>
                        </h4>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          <MapPin className="size-3 text-muted-foreground shrink-0" />
                          <span>{cafe.address}</span>
                        </p>
                      </div>
                    </div>

                    <SaveButton
                      cafe={cafe}
                      initialIsSaved={true}
                      collection={collectionName}
                      variant="card"
                    />
                  </div>

                  {/* Personal Note if exists */}
                  {item.notes && (
                    <div className="mt-3.5 flex items-start gap-2 rounded-2xl border border-accent/20 bg-accent/5 p-2.5 text-xs text-foreground/90">
                      <StickyNote className="size-3.5 text-accent shrink-0 mt-0.5" />
                      <p className="line-clamp-2 italic">{item.notes}</p>
                    </div>
                  )}

                  {/* Categories */}
                  {cafe.categories && cafe.categories.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {cafe.categories.slice(0, 3).map((cat) => (
                        <span
                          key={cat}
                          className="rounded-md border border-border/60 bg-background/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground capitalize"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3 text-xs font-semibold text-accent">
                  <span className="flex items-center gap-1">
                    <BookmarkCheck className="size-3.5" />
                    Saved in {collectionName}
                  </span>
                  <span className="text-[11px] font-normal text-muted-foreground">
                    Tap to view
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Sheet */}
      {presentation === "page" && <CafeDetailSheet
        cafe={selectedCafe}
        isOpen={isDetailSheetOpen}
        onClose={() => setIsDetailSheetOpen(false)}
        initialIsSaved={true}
        initialCollection={collectionName}
      />}
    </div>
  );
}
