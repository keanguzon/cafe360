"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import { ReadFeedback } from "@/components/ui/read-feedback";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Bookmark, Heart } from "lucide-react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { toggleSaveCafeAction } from "@/lib/actions/cafe-actions";
import { useCafeSaveStatus } from "@/lib/hooks/use-cafe-save-status";
import { useCircle } from "@/lib/context/circle-context";
import { isCafeSaveMutationKey } from "@/lib/hooks/use-saved-cafes";
import { CollectionPicker } from "./collection-picker";
import type { CafeSearchResult } from "@/lib/types/places";
import {
  isOnline,
  OFFLINE_MUTATION_MESSAGE,
  useOnlineStatus,
} from "@/lib/hooks/use-online-status";

type SaveButtonProps = {
  cafe: CafeSearchResult;
  initialIsSaved?: boolean;
  collection?: string;
  variant?: "icon" | "card" | "sheet-action" | "button";
  className?: string;
  onSaveStateChange?: (isSaved: boolean, collection?: string) => void;
};

export function SaveButton({
  cafe,
  initialIsSaved,
  collection = "Favorites",
  variant = "icon",
  className = "",
  onSaveStateChange,
}: SaveButtonProps) {
  const online = useOnlineStatus();
  const { accountId } = useCircle();
  const { mutate } = useSWRConfig();
  const scope = `${accountId}:${cafe.id}:${collection}:${variant}`;
  const currentScope = useRef({ scope, accountId });
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useLayoutEffect(() => {
    currentScope.current = { scope, accountId };
  }, [scope, accountId]);
  const status = useCafeSaveStatus(
    accountId,
    cafe.id,
    initialIsSaved === undefined && variant !== "card",
  );
  const [override, setOverride] = useState<{
    scope: string;
    saved: boolean;
    collection: string;
  } | null>(null);
  const local = override?.scope === scope ? override : null;
  const isSaved = local?.saved ?? (
    variant === "card"
      ? status.status
        ? status.status.collections.includes(collection)
        : initialIsSaved ?? false
      : status.status?.isSaved ?? initialIsSaved ?? false
  );
  const activeCollection = local?.collection
    ?? (variant !== "card" ? status.status?.collections[0] : undefined)
    ?? collection;
  const known = !!local
    || !!status.status
    || initialIsSaved !== undefined
    || variant === "card";
  const [pickerScope, setPickerScope] = useState<string | null>(null);
  const pending = useRef<string | null>(null);
  const [pendingScope, setPendingScope] = useState<string | null>(null);
  const isPending = pendingScope === scope;
  const disabled = !online || isPending || !known || !!status.error;
  const [previousInitial, setPreviousInitial] = useState(initialIsSaved);
  if (previousInitial !== initialIsSaved) {
    setPreviousInitial(initialIsSaved);
    setOverride(null);
  }

  const handleQuickToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isOnline()) {
      toast.error(OFFLINE_MUTATION_MESSAGE);
      return;
    }
    if (disabled || pending.current === scope) return;
    void save(!isSaved, activeCollection);
  };

  const save = async (
    saving: boolean,
    selectedCol: string,
    notes?: string,
    reportPickerFailure = false,
  ) => {
    if (!isOnline()) throw new Error(OFFLINE_MUTATION_MESSAGE);
    if (pending.current === scope) return;
    pending.current = scope;
    setPendingScope(scope);
    const generation = currentScope.current;
    const current = () => mounted.current && currentScope.current === generation;
    const remaining = status.status?.collections.filter(
      (item) => item !== selectedCol,
    ) ?? [];
    const nextSaved = saving || (variant !== "card" && remaining.length > 0);
    const nextCollection = saving ? selectedCol : remaining[0] ?? selectedCol;
    setOverride({ scope, saved: nextSaved, collection: nextCollection });
    onSaveStateChange?.(nextSaved, nextSaved ? nextCollection : undefined);
    try {
      let refreshFailed = false;
      await status.mutate(
        async (previous) => {
          const res = await toggleSaveCafeAction({
            cafe,
            collection: selectedCol,
            notes,
            isSaving: saving,
            expectedAccountId: accountId,
          });
          if (!res.success) {
            throw new Error(res.error || "Could not save café. Please retry.");
          }
          refreshFailed = res.refreshFailed ?? false;
          // A supplied card flag describes one collection, so re-read full membership.
          if (!previous) return undefined;
          const collections = saving
            ? [...new Set([...previous.status.collections, selectedCol])]
            : previous.status.collections.filter((item) => item !== selectedCol);
          return {
            status: { isSaved: collections.length > 0, collections },
            fetchedAt: Date.now(),
          };
        },
        { revalidate: false, rollbackOnError: true, throwOnError: true },
      );
      if (currentScope.current.accountId === accountId) {
        void mutate((key) => isCafeSaveMutationKey(key, accountId, cafe.id), undefined, { revalidate: true }).catch(() => {});
      }
      if (!current()) return;
      if (status.status || initialIsSaved === undefined && variant !== "card") {
        setOverride(null);
      }
      if (refreshFailed) {
        toast.error(
          `Café ${saving ? "saved" : "removed"}, but some views could not refresh. Please refresh them.`,
        );
      } else {
        toast.success(saving ? "Café saved" : "Café removed", {
          description: `${saving ? "Saved to" : "Removed from"} ${selectedCol}`,
        });
      }
    } catch (error) {
      if (!current()) return;
      setOverride(null);
      onSaveStateChange?.(isSaved, isSaved ? activeCollection : undefined);
      toast.error(
        error instanceof Error ? error.message : "Could not update café",
      );
      if (reportPickerFailure) throw error;
    } finally {
      if (pending.current === scope) pending.current = null;
      if (current()) setPendingScope(null);
    }
  };
  const handleSelectCollection = async (selectedCol: string, notes?: string) =>
    save(true, selectedCol, notes, true);

  return (
    <>
      {variant === "sheet-action" ? (
        <button
          type="button"
          onClick={handleQuickToggle}
          onContextMenu={(e) => {
            e.preventDefault();
            if (!disabled) setPickerScope(scope);
          }}
          disabled={disabled}
          className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 text-xs font-medium transition-all active:scale-95 cursor-pointer ${
            isSaved
              ? "border-accent bg-accent/20 text-accent font-semibold shadow-xs"
              : "border-border bg-background/60 text-foreground hover:border-accent/40"
          } ${className}`}
        >
          {isPending ? (
            <span aria-hidden="true">…</span>
          ) : (
            <Bookmark className={`size-4 transition-transform ${isSaved ? "fill-accent scale-110" : ""}`} />
          )}
          <span>
            {!known
              ? status.error ? "Save unavailable" : "Checking saved status"
              : isSaved ? activeCollection : "Save"}
          </span>
        </button>
      ) : variant === "card" ? (
        <button
          type="button"
          onClick={handleQuickToggle}
          disabled={disabled}
          aria-label={isSaved ? "Unsave café" : "Save café"}
          className={`flex size-8 shrink-0 items-center justify-center rounded-xl border transition-all active:scale-90 hover:scale-105 ${
            isSaved
              ? "border-accent/40 bg-accent/20 text-accent shadow-xs"
              : "border-border/60 bg-surface/90 text-muted-foreground hover:border-accent hover:text-accent"
          } ${className}`}
        >
          {isPending ? (
            <span aria-hidden="true">…</span>
          ) : (
            <Heart
              className={`size-3.5 transition-colors ${
                isSaved ? "fill-accent text-accent" : ""
              }`}
            />
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleQuickToggle}
          disabled={disabled}
          aria-label={isSaved ? "Unsave café" : "Save café"}
          className={`flex size-9 items-center justify-center rounded-full border transition-all active:scale-90 hover:scale-105 ${
            isSaved
              ? "border-accent bg-accent/20 text-accent shadow-sm"
              : "border-border bg-background/80 text-muted-foreground hover:border-accent/60 hover:text-foreground"
          } ${className}`}
        >
          {isPending ? (
            <span aria-hidden="true">…</span>
          ) : (
            <Heart
              className={`size-4 transition-colors ${
                isSaved ? "fill-accent text-accent" : ""
              }`}
            />
          )}
        </button>
      )}

      {(isPending || !known || status.error) && pickerScope !== scope && <div
        className={variant === "sheet-action" ? "order-last col-span-full" : variant === "card" ? "absolute inset-x-2 top-2 z-20 rounded-xl border border-border bg-background p-3 shadow-sm" : "w-full"}
        onClick={event => event.stopPropagation()}
      >
        <ActionFeedback pending={isPending} operationKey={`save:${scope}`} label="Updating saved café…" />
        <ReadFeedback pending={!known && !status.error} error={status.error} operationKey={`saved-status-refresh:${scope}`} label="Checking saved status…" retry={() => status.refresh()} />
      </div>}
      <CollectionPicker
        key={scope}
        isOpen={pickerScope === scope}
        onClose={() => setPickerScope(null)}
        selectedCollection={activeCollection}
        onSelectCollection={handleSelectCollection}
        cafeName={cafe.name}
      />
    </>
  );
}
