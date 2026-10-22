"use client";

import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { List } from "lucide-react";
import { useNavigationState, type NavigationSnapshot } from "@/lib/context/navigation-state";

type Search = Omit<NonNullable<NavigationSnapshot["nearbyList"]>, "filterTopRated">;

export function NearbyListLink({ search, filterTopRated, iconOnly=false }: { search: Search | null; filterTopRated: boolean; iconOnly?:boolean }) {
  const { update } = useNavigationState();
  const className = iconOnly ? "flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors hover:border-accent focus-visible:ring-2 focus-visible:ring-accent" : "inline-flex min-h-11 items-center rounded-full border border-border/80 bg-surface/90 px-3.5 py-1.5 text-xs font-semibold text-foreground shadow-sm backdrop-blur-md hover:border-accent";
  const content=iconOnly ? <List className="size-4" aria-hidden="true"/> : "List nearby";
  if (!search) return <button type="button" disabled aria-label="List nearby" title="Search an area to open its café list" className={`${className} opacity-70`}>{content}</button>;
  return <Link href="/discover?from=map" aria-label="List nearby" title="List nearby" className={className} onClick={() => update({ nearbyList: { ...search, coordinates: [...search.coordinates], filterTopRated } })}>{content}</Link>;
}
