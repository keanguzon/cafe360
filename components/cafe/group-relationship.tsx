"use client";
import { ReadFeedback } from "@/components/ui/read-feedback";
import { UserAvatar } from "@/components/ui/user-avatar";

import { useMemo } from "react";
import { Bookmark, Coffee, HeartHandshake, Star, Users } from "lucide-react";
import { useCircle } from "@/lib/context/circle-context";
import type { FriendProfile } from "@/lib/types/social";

type GroupRelationshipProps = {
  cafeId: string;
};

export function GroupRelationship({ cafeId }: GroupRelationshipProps) {
  const {
    accountId,
    error,
    refreshCircleData,
    activeCircle,
    circleMembers,
    circleVisits,
    circleSavedCafes,
    circleCafeSummaries,
    isLoading,
  } = useCircle();

  const stats = useMemo(() => {
    if (!activeCircle || !cafeId) return null;

    const summary = circleCafeSummaries.find(
      (item) => item.internalId === cafeId || item.providerId === cafeId,
    );
    const matchingIds = new Set<string>([cafeId]);
    if (summary) {
      matchingIds.add(summary.internalId);
      matchingIds.add(summary.providerId);
    }

    const savedByMap = new Map<string, FriendProfile>();
    for (const saved of circleSavedCafes) {
      if (saved.group_id === activeCircle.id && matchingIds.has(saved.cafe_id) && saved.saved_by) {
        const member = circleMembers.find((m) => m.userId === saved.saved_by);
        if (member) {
          savedByMap.set(member.userId, {
            id: member.userId,
            username: member.displayName,
            display_name: member.displayName,
            avatar_url: member.avatarUrl,
          });
        }
      }
    }

    const matchingVisits = circleVisits.filter((visit) => {
      if (visit.group_id !== activeCircle.id) return false;
      const cafeRecord = visit.cafe as { id?: string; provider_place_id?: string } | undefined;
      return (
        matchingIds.has(visit.cafe_id) ||
        (cafeRecord?.id ? matchingIds.has(cafeRecord.id) : false) ||
        (cafeRecord?.provider_place_id ? matchingIds.has(cafeRecord.provider_place_id) : false)
      );
    });

    const visitedByMap = new Map<string, FriendProfile>();
    let ratingSum = 0;
    let ratingCount = 0;

    for (const visit of matchingVisits) {
      if (visit.creator?.id) {
        visitedByMap.set(visit.creator.id, {
          id: visit.creator.id,
          username: visit.creator.username,
          display_name: visit.creator.display_name,
          avatar_url: visit.creator.avatar_url,
        });
      }
      if (typeof visit.rating === "number" && visit.rating >= 0) {
        ratingSum += visit.rating;
        ratingCount += 1;
      }
    }

    const savedByFriends = Array.from(savedByMap.values());
    const visitedByFriends = Array.from(visitedByMap.values());
    const averageRating =
      summary?.rating !== undefined && summary?.rating !== null
        ? summary.rating
        : ratingCount > 0
          ? Number((ratingSum / ratingCount).toFixed(1))
          : null;

    return {
      savedCount: savedByFriends.length,
      visitCount: summary ? summary.visitCount : matchingVisits.length,
      averageRating,
      savedByFriends,
      visitedByFriends,
    };
  }, [activeCircle, cafeId, circleCafeSummaries, circleMembers, circleSavedCafes, circleVisits]);

  if ((isLoading || error) && (!stats || (stats.savedCount === 0 && stats.visitCount === 0))) return <ReadFeedback pending={isLoading} error={error} operationKey={`relationship:${accountId}:${activeCircle?.id ?? ""}:${cafeId}`} label="Loading Circle connection…" retry={refreshCircleData}/>;

  if (!stats || (stats.savedCount === 0 && stats.visitCount === 0)) {
    return (
      <div className="rounded-2xl border border-dashed border-border/80 bg-surface/30 p-3.5 text-center">
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
          <HeartHandshake className="size-3.5 text-accent/70" />
          <span>Be the first in your circle to save or visit this spot!</span>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Users className="size-3.5 text-accent" />
          <span>Circle Connection</span>
        </h4>
        {stats.averageRating !== null && (
          <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
            <Star className="size-3 fill-amber-400 text-amber-400" />
            <span>{stats.averageRating.toFixed(1)} circle avg</span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {/* Saved Count & Avatars */}
        <div className="flex flex-col gap-1.5 rounded-xl border border-border/50 bg-background/50 p-2.5">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Bookmark className="size-3 text-amber-400" />
            <span>Saved by {stats.savedCount} {stats.savedCount === 1 ? "member" : "members"}</span>
          </div>
          {stats.savedByFriends.length > 0 && (
            <div className="flex -space-x-1.5 pt-0.5">
              {stats.savedByFriends.slice(0, 4).map((p) => (
                <UserAvatar
                  key={p.id}
                  name={p.display_name}
                  src={p.avatar_url}
                  className="size-6 rounded-full border-2 border-surface overflow-hidden bg-accent/10 flex items-center justify-center text-[9px] font-bold text-accent"
                />
              ))}
            </div>
          )}
        </div>

        {/* Visited Count & Avatars */}
        <div className="flex flex-col gap-1.5 rounded-xl border border-border/50 bg-background/50 p-2.5">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Coffee className="size-3 text-accent" />
            <span>{stats.visitCount} {stats.visitCount === 1 ? "circle visit" : "circle visits"}</span>
          </div>
          {stats.visitedByFriends.length > 0 && (
            <div className="flex -space-x-1.5 pt-0.5">
              {stats.visitedByFriends.slice(0, 4).map((p) => (
                <UserAvatar
                  key={p.id}
                  name={p.display_name}
                  src={p.avatar_url}
                  className="size-6 rounded-full border-2 border-surface overflow-hidden bg-accent/10 flex items-center justify-center text-[9px] font-bold text-accent"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
