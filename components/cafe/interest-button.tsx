"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";

import { useOptimistic, useTransition } from "react";
import { Heart } from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { toggleInterestAction } from "@/lib/actions/cafe-actions";
import { useCircle } from "@/lib/context/circle-context";
import type { CafeSearchResult } from "@/lib/types/places";
import { isOnline, OFFLINE_MUTATION_MESSAGE, useOnlineStatus } from "@/lib/hooks/use-online-status";

export interface InterestButtonProps {
  cafe: CafeSearchResult;
}

export function InterestButton({ cafe }: InterestButtonProps) {
  const online = useOnlineStatus();
  const { activeCircle, accountId, circleCafeSummaries, invalidateCircle } = useCircle();
  const [isPending, startTransition] = useTransition();
  const interestedUsers = circleCafeSummaries.find((item) => item.providerId === cafe.id)?.interestedMembers || [];
  const savedInterest = interestedUsers.some((member) => member.id === accountId);
  const [isInterested, setIsInterested] = useOptimistic(savedInterest, (_previous, next: boolean) => next);

  const handleToggle = () => {
    if (isPending) return;
    if (!isOnline()) { toast.error(OFFLINE_MUTATION_MESSAGE); return; }
    if (!activeCircle?.id) {
      toast.error("Please select a circle first to express interest.");
      return;
    }

    startTransition(async () => {
      const newStatus = !isInterested;
      setIsInterested(newStatus);
      try {
        const result = await toggleInterestAction(cafe, activeCircle.id, newStatus);
        if (!result.success) {
          toast.error(result.error || "Failed to update interest status.");
          return;
        }
        await invalidateCircle(activeCircle.id);
        toast.success(newStatus ? `You're interested in ${cafe.name}!` : "Interest removed.");
      } catch {
        toast.error("Could not update interest. Please try again.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <ActionFeedback pending={isPending} operationKey={`interest:${accountId}:${activeCircle?.id}:${cafe.id}`} label="Updating interest…" />
      <button
        type="button"
        disabled={!online || isPending}
        onClick={handleToggle}
        aria-pressed={isInterested}
        className={cn(
          "w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all active:scale-95 disabled:opacity-70 disabled:pointer-events-none",
          isInterested
            ? "bg-rose-500/10 border-2 border-rose-500/20 text-rose-500"
            : "bg-surface-elevated border-2 border-border text-foreground hover:border-border/80"
        )}
      >
        <Heart className={cn("size-4.5", isInterested && "fill-rose-500")} />
        <span>{isInterested ? "I'm Interested!" : "I'm Interested"}</span>
      </button>

      {interestedUsers.length > 0 && (
        <div className="flex -space-x-2 overflow-hidden items-center mt-1">
          {interestedUsers.slice(0, 5).map((user) => (
            <UserAvatar
              key={user.id}
              className="size-6 ring-2 ring-background text-[10px]"
              src={user.avatar_url}
              name={user.display_name}
            />
          ))}
          {interestedUsers.length > 5 && (
            <div className="flex size-6 items-center justify-center rounded-full bg-surface-elevated ring-2 ring-background text-[9px] font-bold text-muted-foreground">
              +{interestedUsers.length - 5}
            </div>
          )}
          <span className="ml-3 text-xs text-muted-foreground font-medium">
            {interestedUsers.length === 1 ? 'is interested' : 'are interested'}
          </span>
        </div>
      )}
    </div>
  );
}
