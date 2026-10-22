"use client";

import { Coffee } from "lucide-react";
import { useCircle } from "@/lib/context/circle-context";
import { selectCafeVisits } from "@/lib/utils/cafe-visits";
import { PrivatePhoto } from "@/components/visit/private-photo";
import { ReadFeedback } from "@/components/ui/read-feedback";

type CafePhotosProps = {
  photos?: string[];
  cafeName: string;
  cafeId: string;
};

export function CafePhotos({ photos, cafeName, cafeId }: CafePhotosProps) {
  const { accountId, activeCircle, circleVisits, circleCafeSummaries, isLoading, error, refreshCircleData } = useCircle();
  const seenPaths = new Set<string>();
  const privatePhotos = accountId && activeCircle
    ? selectCafeVisits(circleVisits, circleCafeSummaries, cafeId, activeCircle.id)
      .flatMap((visit) => visit.photos ?? []).filter((photo) => {
        if (!photo.storage_path || seenPaths.has(photo.storage_path)) return false;
        seenPaths.add(photo.storage_path);
        return true;
      }).slice(0, 5)
    : [];
  const hasPrivatePhotos = privatePhotos.length > 0;
  const status = activeCircle && isLoading ? "Loading Circle photos…"
    : activeCircle && error ? "Circle photos unavailable" : "No cover photo available";
  if (!hasPrivatePhotos && (!photos || photos.length === 0)) {
    if (activeCircle && (isLoading || error)) return <div className="flex h-36 items-center justify-center rounded-2xl border border-border bg-background p-3">
      <ReadFeedback pending={isLoading} error={error ? "Circle photos unavailable" : null} operationKey={`cover:${accountId}:${activeCircle.id}:${cafeId}`} label="Loading Circle photos…" retry={refreshCircleData}/>
    </div>;
    return (
      <div className="relative flex h-36 w-full items-center justify-center overflow-hidden rounded-2xl border border-border/80 bg-background/60">
        <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
          <div className="flex size-10 items-center justify-center rounded-full bg-surface border border-border text-accent">
            <Coffee className="size-5" />
          </div>
          <span className="text-xs font-medium">{cafeName}</span>
          <span role={activeCircle && isLoading ? "status" : undefined} className="text-[10px] text-muted-foreground/80">{status}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x">
      {hasPrivatePhotos ? privatePhotos.map((photo) => (
        <div
          key={`${accountId}:${activeCircle?.id}:${cafeId}:${photo.id}`}
          className="relative h-40 w-56 shrink-0 overflow-hidden rounded-2xl border border-border bg-surface snap-start"
        >
          <PrivatePhoto path={photo.storage_path} />
        </div>
      )) : photos?.map((url, idx) => (
        <div
          key={idx}
          className="relative h-40 w-56 shrink-0 overflow-hidden rounded-2xl border border-border bg-surface snap-start"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={`${cafeName} photo ${idx + 1}`}
            className="size-full object-cover transition-transform duration-300 hover:scale-105"
          />
        </div>
      ))}
    </div>
  );
}
