"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";

import { useId, useLayoutEffect, useRef, useState, useTransition } from "react";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import { useCircle } from "@/lib/context/circle-context";
import {
  removeCafeFromCircleAction,
  saveCafeToCircleAction,
} from "@/lib/actions/circle-save-actions";
import {
  isOnline,
  OFFLINE_MUTATION_MESSAGE,
  useOnlineStatus,
} from "@/lib/hooks/use-online-status";
import type { CafeSearchResult } from "@/lib/types/places";
import type { CafeReference } from "@/lib/types/circle-cafe";

export function CircleSaveButton({
  cafe,
  className = "",
}: {
  cafe: CafeSearchResult;
  className?: string;
}) {
  const context = useCircle();
  const {
    accountId,
    activeCircle,
    circleSavedCafes,
    circleCafeSummaries,
    isLoading,
    error,
  } = context;
  const online = useOnlineStatus();
  const [pending, setPending] = useState(false);
  const [pendingPhase, setPendingPhase] = useState<"Saving…" | "Removing…" | "Refreshing Circle…" | null>(null);
  const [, startTransition] = useTransition();
  const pendingRef = useRef(false);
  const toastSequence = useRef(0);
  const latest = useRef({
    accountId,
    circleId: activeCircle?.id,
    cafeId: cafe.id,
    internalId: cafe.internalId,
    invalidate: context.invalidateCircle,
  });
  useLayoutEffect(() => {
    latest.current = {
      accountId,
      circleId: activeCircle?.id,
      cafeId: cafe.id,
      internalId: cafe.internalId,
      invalidate: context.invalidateCircle,
    };
  }, [accountId, activeCircle?.id, cafe.id, cafe.internalId, context.invalidateCircle]);
  const guidanceId = useId();
  const internalId = cafe.internalId ?? circleCafeSummaries.find(
    item => item.providerId === cafe.id || item.internalId === cafe.id,
  )?.internalId;
  const saved = circleSavedCafes.find(item => item.cafe_id === (internalId ?? cafe.id));
  const owned = saved?.saved_by === accountId;
  const label = activeCircle
    ? `${saved ? owned ? "Remove from" : "Saved to" : "Save to"} ${activeCircle.name}`
    : "Select a Circle to save";
  const guidance = !online
    ? OFFLINE_MUTATION_MESSAGE
    : error
      ? "Circle saves could not be loaded. Refresh and retry."
      : saved && !owned
        ? "Only the member who saved this café can remove it from the Circle."
        : null;

  function handleClick() {
    if (!isOnline()) {
      toast.error(OFFLINE_MUTATION_MESSAGE);
      return;
    }
    if (pendingRef.current || !activeCircle || isLoading || error || (saved && !owned)) {
      return;
    }
    pendingRef.current = true;
    setPending(true);
    setPendingPhase(saved ? "Removing…" : "Saving…");
    const toastId = `${guidanceId}-${++toastSequence.current}`;
    const captured = {
      accountId,
      circleId: activeCircle.id,
      cafeId: cafe.id,
      internalId: cafe.internalId,
    };
    const sameScope = () => (
      latest.current.accountId === captured.accountId &&
      latest.current.circleId === captured.circleId &&
      latest.current.cafeId === captured.cafeId &&
      latest.current.internalId === captured.internalId
    );
    const reference: CafeReference = internalId
      ? { kind: "internal", id: internalId }
      : { kind: "provider", id: cafe.id };
    const removing = Boolean(saved);

    startTransition(async () => {
      try {
        const result = await (removing ? removeCafeFromCircleAction : saveCafeToCircleAction)({
          groupId: captured.circleId,
          cafe: reference,
        });
        if (!result.success) {
          if (sameScope()) toast.error(result.error || "Could not update the Circle save");
          return;
        }
        if (sameScope()) {
          toast.success(
            removing ? `Removed from ${activeCircle.name}` : `Saved to ${activeCircle.name}`,
            { id: toastId },
          );
        }
        let refreshFailed = result.refreshFailed;
        if (latest.current.accountId === captured.accountId) {
          setPendingPhase("Refreshing Circle…");
          try {
            await latest.current.invalidate(captured.circleId);
          } catch {
            refreshFailed = true;
          }
        }
        if (!sameScope()) return;
        if (refreshFailed) {
          toast.error(
            removing ? "Café removed; Circle refresh failed" : "Café saved; Circle refresh failed",
            {
              id: toastId,
              description: "Your change was saved. Refresh the Circle before making another change.",
            },
          );
        }
      } catch (cause) {
        if (sameScope()) {
          toast.error(cause instanceof Error ? cause.message : "Could not update the Circle save");
        }
      } finally {
        pendingRef.current = false;
        setPending(false);
        setPendingPhase(null);
      }
    });
  }

  return (
    <div className={className}>
      <ActionFeedback pending={pending} operationKey={`circle-save:${accountId}:${activeCircle?.id}:${cafe.id}`} label="Updating Circle café…" />
      <button
        type="button"
        onClick={handleClick}
        disabled={
          !online || !activeCircle || isLoading || Boolean(error) ||
          pending || Boolean(saved && !owned)
        }
        aria-describedby={guidance ? guidanceId : undefined}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? (
          <span aria-hidden="true">…</span>
        ) : (
          <Bookmark aria-hidden="true" className="size-4" />
        )}
        {pending ? pendingPhase : label}
      </button>
      {guidance && (
        <p id={guidanceId} role="status" className="mt-2 text-xs text-muted-foreground">
          {guidance}
        </p>
      )}
    </div>
  );
}
