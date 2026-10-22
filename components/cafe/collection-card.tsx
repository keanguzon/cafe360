"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";

import { useEffect, useRef, useState, useTransition } from "react";
import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { Coffee, FolderHeart, MoreVertical, Trash2 } from "lucide-react";
import { deleteCollectionAction } from "@/lib/actions/cafe-actions";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { useCircle } from "@/lib/context/circle-context";
import { isPersonalCollectionKey } from "@/lib/hooks/use-saved-cafes";
import type { CollectionSummary } from "@/lib/types/saved-cafe";

import type { SheetRoute } from "@/lib/navigation/sheet-routes";

type CollectionCardProps = {
  presentation?: "page" | "sheet";
  onOpen?: (route: SheetRoute) => void;
  collection: CollectionSummary;
  onDeleted?: (name: string) => void;
};

export function CollectionCard({ collection, onDeleted, presentation = "page", onOpen }: CollectionCardProps) {
  const { accountId } = useCircle();
  const { mutate } = useSWRConfig();
  const [showMenu, setShowMenu] = useState(false);
  const [isPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  const isDefaultFavorites = collection.name.toLowerCase() === "favorites";

  // Close menu on click outside
  useEffect(() => {
    if (!showMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMenu]);

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isPending) return;

    if (confirm(`Are you sure you want to delete the "${collection.name}" collection?`)) {
      startTransition(async () => {
        try {
          const res = await deleteCollectionAction(collection.name);
          if (res.success) {
            onDeleted?.(collection.name);
            void mutate((key) => isPersonalCollectionKey(key, accountId), undefined, { revalidate: true }).catch(() => undefined);
          } else { toast.error(res.error || "Could not delete collection."); }
        } catch {
          toast.error("Could not delete collection. Refresh to check its latest status.");
        }
      });
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-border/80 bg-surface/70 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-accent hover:bg-surface hover:shadow-xl">
      <ActionFeedback pending={isPending} operationKey={`delete-collection:${accountId}:${collection.name}`} label="Deleting collection…" />
      <Link
        href={`/profile/collections/${encodeURIComponent(collection.name)}`}
        onClick={e=>{if(presentation === "sheet" && onOpen && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey){e.preventDefault();onOpen({kind:"collection",root:"saved",entityId:collection.name});}}}
        className="block"
      >
        <div className="flex items-start justify-between">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-accent/15 text-accent border border-accent/20 transition-transform group-hover:scale-105">
            <FolderHeart className="size-6" strokeWidth={1.75} />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="rounded-full border border-border/60 bg-background/60 px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
              {collection.count} {collection.count === 1 ? "café" : "cafés"}
            </span>

            {!isDefaultFavorites && (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowMenu(!showMenu);
                  }}
                  aria-label="Collection options"
                  className="rounded-full p-1 text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
                >
                  <MoreVertical className="size-4" />
                </button>

                {showMenu && (
                  <div
                    className="absolute right-0 top-7 z-20 w-36 rounded-xl border border-border bg-surface p-1 shadow-lg animate-in fade-in zoom-in-95"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isPending}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                      Delete Collection
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <h3 className="text-lg font-bold tracking-tight text-foreground group-hover:text-accent transition-colors">
            {collection.name}
          </h3>

          {collection.sampleCafes && collection.sampleCafes.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Coffee className="size-3 text-accent shrink-0" />
              <span className="truncate max-w-[220px]">
                {collection.sampleCafes.join(" • ")}
              </span>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              No saved spots yet
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3 text-xs font-semibold text-accent">
          <span>View Collection</span>
          <span className="text-[11px] font-normal text-muted-foreground">Tap to open</span>
        </div>
      </Link>
    </div>
  );
}
