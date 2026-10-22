"use client";

import { Coffee, MapPin, Navigation, Star } from "lucide-react";
import { SaveButton } from "./save-button";
import type { CafeSearchResult } from "@/lib/types/places";

type CafeCardProps = {
  cafe: CafeSearchResult;
  onSelect?: (cafe: CafeSearchResult) => void;
  className?: string;
  showSaveButton?: boolean;
};

export function CafeCard({
  cafe,
  onSelect,
  className = "",
  showSaveButton = true,
}: CafeCardProps) {
  const distanceFormatted =
    cafe.distanceMeters !== undefined
      ? cafe.distanceMeters < 1000
        ? `${cafe.distanceMeters}m away`
        : `${(cafe.distanceMeters / 1000).toFixed(1)}km away`
      : null;

  const priceSymbols = cafe.priceLevel != null ? "$".repeat(cafe.priceLevel) : "Price unknown";

  return (
    <div
      tabIndex={onSelect ? 0 : undefined}
      role={onSelect ? "group" : undefined}
      aria-label={onSelect ? `${cafe.name} café details` : undefined}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || !onSelect) return;
        if (event.key === "Enter" || event.key === " ") { event.preventDefault();onSelect(cafe); }
      }}
      onClick={() => onSelect?.(cafe)}
      className={`group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-surface/80 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:bg-surface hover:shadow-lg active:scale-[0.99] cursor-pointer ${className}`}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent border border-accent/20">
              <Coffee className="size-4.5" strokeWidth={2} aria-hidden="true" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground group-hover:text-accent transition-colors truncate max-w-[170px] sm:max-w-[240px]">
                {cafe.name}
              </h4>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                <span className="flex items-center gap-0.5 font-semibold text-amber-400">
                  <Star className="size-3 fill-amber-400 text-amber-400" />
                  {cafe.rating ? cafe.rating.toFixed(1) : "New"}
                </span>
                <span>•</span>
                <span className="font-mono text-muted-foreground">{priceSymbols}</span>
                {distanceFormatted && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-0.5 text-accent font-medium">
                      <Navigation className="size-2.5" />
                      {distanceFormatted}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {showSaveButton && (
            <SaveButton cafe={cafe} variant="card" />
          )}
        </div>

        <p className="mt-2.5 flex items-start gap-1.5 text-xs text-muted-foreground line-clamp-1">
          <MapPin className="size-3.5 shrink-0 mt-0.5 text-muted-foreground" aria-hidden="true" />
          <span>{cafe.address}</span>
        </p>

        {cafe.categories && cafe.categories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {cafe.categories.slice(0, 3).map((cat) => (
              <span
                key={cat}
                className="inline-flex items-center rounded-md border border-border/60 bg-background/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground capitalize"
              >
                {cat}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2.5 text-xs font-semibold text-accent">
        <span>View details & reviews</span>
        <span className="text-[10px] font-normal text-muted-foreground">Tap to expand</span>
      </div>
    </div>
  );
}
