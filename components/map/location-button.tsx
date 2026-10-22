"use client";

import { Loader2, Locate, LocateFixed } from "lucide-react";

type LocationButtonProps = {
  hasLocation: boolean;
  isLocating: boolean;
  onClick: () => void;
};

export function LocationButton({
  hasLocation,
  isLocating,
  onClick,
}: LocationButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLocating}
      aria-label={hasLocation ? "Re-center map on my location" : "Find my location"}
      title={hasLocation ? "Re-center on my location" : "Find my location"}
      className="group relative flex size-11 items-center justify-center rounded-xl border border-border bg-surface/90 text-foreground shadow-lg backdrop-blur-md transition-all duration-200 hover:border-accent hover:bg-surface hover:text-accent active:scale-95 disabled:pointer-events-none disabled:opacity-60 cursor-pointer"
    >
      {isLocating ? (
        <Loader2 className="size-5 animate-spin text-accent" aria-hidden="true" />
      ) : hasLocation ? (
        <LocateFixed className="size-5 text-accent transition-transform group-hover:scale-110" aria-hidden="true" />
      ) : (
        <Locate className="size-5 text-muted-foreground transition-colors group-hover:text-accent" aria-hidden="true" />
      )}

      {hasLocation && (
        <span className="absolute -top-1 -right-1 flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-75" />
          <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
        </span>
      )}
    </button>
  );
}
