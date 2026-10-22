"use client";
import { ReadFeedback } from "@/components/ui/read-feedback";

import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { Compass, FolderHeart } from "lucide-react";
import { CollectionCard } from "@/components/cafe/collection-card";
import { useCircle } from "@/lib/context/circle-context";
import { usePersonalCollections } from "@/lib/hooks/use-saved-cafes";

import type { SheetRoute } from "@/lib/navigation/sheet-routes";

export function CollectionsContent({presentation = "page", onOpen, active = true}: {presentation?: "page" | "sheet"; onOpen?: (route: SheetRoute) => void; active?: boolean} = {}) {
  const { accountId } = useCircle();
  const { collections, initialLoading, error, refresh } = usePersonalCollections(accountId, active);

  if (initialLoading || (error && collections.length === 0)) return <ReadFeedback pending={active && initialLoading} error={error} operationKey={`collections:${accountId}`} label="Loading collections…" retry={refresh} className="py-12"/>;

  return (
    <>
      {error && <p role="alert" className="text-sm text-destructive">Could not refresh collections: {error}</p>}
      {collections.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-12 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent/15 text-accent border border-accent/20">
            <FolderHeart className="size-7" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-foreground">No saved cafés yet</h3>
          <p className="mx-auto mt-1.5 max-w-sm text-xs text-muted-foreground">
            Save your favorite coffee spots while exploring the map to build your personal café collections.
          </p>
          <div className="mt-6">
            <Link href="/map" onClick={e=>{if(presentation === "sheet" && onOpen && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey){e.preventDefault();onOpen({kind:"nearby",root:"nearby"});}}} className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-xs font-semibold text-accent-foreground shadow-md hover:brightness-110 transition-all">
              <Compass className="size-4" />Discover Nearby Cafés
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {collections.map((collection) => <CollectionCard key={collection.name} collection={collection} presentation={presentation} onOpen={onOpen} />)}
        </div>
      )}
    </>
  );
}
