"use client";

import { Coffee, Key, MapPin, Sparkles } from "lucide-react";

import { CAVITE_DEFAULT_COORDINATES } from "@/lib/hooks/use-location";
import { Button } from "@/components/ui/button";
import { refreshPage } from "@/lib/navigation/browser-recovery";

export function MapFallback({ message }: { message?: string | null }) {
  const title = message ? "Map Unavailable" : "Mapbox Token Required";
  const description = message || (
    <>
      To enable live Mapbox GL rendering and explore cafés in real-time, add your public token to{" "}
      <code className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px] text-accent">
        .env.local
      </code>
      .
    </>
  );

  return (
    <div className="relative flex size-full min-h-[420px] flex-col items-center justify-center overflow-hidden bg-surface p-6 text-center">
      {/* Visual background grid pattern simulating map tiles */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(var(--border) 1px, transparent 1px), radial-gradient(var(--border) 1px, var(--background) 1px)",
          backgroundSize: "32px 32px",
          backgroundPosition: "0 0, 16px 16px",
        }}
      />

      {/* Decorative mock radar pulse */}
      <div className="relative mb-6 flex size-24 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-accent/20" />
        <div className="absolute inset-2 animate-pulse rounded-full border border-accent/40 bg-surface" />
        <div className="relative flex size-14 items-center justify-center rounded-full bg-accent/15 text-accent shadow-inner">
          <Coffee className="size-7" aria-hidden="true" strokeWidth={1.75} />
        </div>
      </div>

      <div className="relative z-10 max-w-md space-y-3">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
          <Sparkles className="size-3.5" aria-hidden="true" />
          <span>Interactive Map Ready</span>
        </div>

        <h2 className="text-xl font-bold tracking-tight text-foreground">
          {title}
        </h2>

        <p className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
        <Button type="button" variant="outline" onClick={refreshPage}>Refresh page</Button>

        <div className="mt-4 rounded-xl border border-border bg-background/80 p-3.5 text-left text-xs space-y-2 backdrop-blur-xs">
          <div className="flex items-center gap-2 text-muted-foreground font-mono text-[11px]">
            <Key className="size-3.5 text-accent shrink-0" aria-hidden="true" />
            <span>NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground font-mono text-[11px]">
            <MapPin className="size-3.5 text-accent shrink-0" aria-hidden="true" />
            <span>
              Default Region: Cavite [{CAVITE_DEFAULT_COORDINATES.join(", ")}]
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
