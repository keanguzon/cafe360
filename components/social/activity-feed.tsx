"use client";

import type { SheetRoute } from "@/lib/navigation/sheet-routes";
import { useState } from "react";
import { ReadFeedback } from "@/components/ui/read-feedback";
import { Activity as ActivityIcon, RefreshCw } from "lucide-react";
import { ActivityItem } from "./activity-item";
import { useCircle } from "@/lib/context/circle-context";
import { useCircleActivity } from "@/lib/hooks/use-circle-activity";
import type { Activity } from "@/lib/types/social";

type ActivityFeedProps = {
  groupId?: string;
  onOpen?: (route: SheetRoute) => void;
  onActivityTap?: (activity: Activity) => void;
};

export function ActivityFeed({ groupId, onActivityTap, onOpen }: ActivityFeedProps) {
  const { accountId } = useCircle();
  const { activities, hasMore, initialLoading, refreshing, error, refresh, loadMore } = useCircleActivity(accountId, groupId ?? null);
  const handleTap = onActivityTap ?? (onOpen ? (activity: Activity) => { if(activity.cafe_id) onOpen({kind:"cafe",root:"nearby",entityId:activity.cafe_id,circleId:groupId}); else if(activity.visit_id) onOpen({kind:"memory",root:"nearby",entityId:activity.visit_id,circleId:groupId}); } : undefined);
  const scope = `${accountId}:${groupId}`;
  const [action, setAction] = useState<{ scope: string; kind: "refresh" | "more" } | null>(null);
  const isPending = action?.scope === scope;
  const isRefreshing = isPending && action?.kind === "refresh";
  const run = async (kind: "refresh" | "more") => {
    if (isPending || refreshing) return;
    const attempt = { scope, kind };
    setAction(attempt);
    try { await (kind === "refresh" ? refresh() : loadMore()); }
    catch { /* The read owner exposes the actual error. */ }
    finally { setAction(current => current === attempt ? null : current); }
  };
  const handleRefresh = () => { void run("refresh"); };
  const handleLoadMore = () => { void run("more"); };

  return (
    <div className="space-y-4">
      <ReadFeedback pending={isPending} operationKey={`activity-action:${scope}:${action?.kind}`} label={isRefreshing ? "Refreshing activity…" : "Loading earlier activity…"} />
      {/* Header controls */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Activity
        </h2>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing || isPending}
          className="flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-accent/30 hover:text-foreground disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className="size-3" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Feed List */}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {initialLoading ? <ReadFeedback pending operationKey={`activity:${scope}`} label="Loading Circle activity…" retry={refresh} /> : activities.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-12 text-center">
          <ActivityIcon className="size-10 text-muted-foreground/30" />
          <p className="text-sm font-medium text-foreground">{groupId ? "No recent Circle activity" : "Select a Circle to view activity"}</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Visits and memories shared with this Circle will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {activities.map((activity) => (
            handleTap ? <button key={activity.id} type="button" className="w-full text-left focus-visible:ring-2 focus-visible:ring-accent" onClick={() => handleTap(activity)}><ActivityItem activity={activity} /></button> : <ActivityItem key={activity.id} activity={activity} />
          ))}
        </div>
      )}

      {/* Load More Button */}
      {hasMore && activities.length > 0 && (
        <div className="pt-2 text-center">
          <button
            onClick={handleLoadMore}
            disabled={isPending}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-6 text-xs font-medium text-foreground transition-colors hover:border-accent/40 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {isPending ? (
              <>

                <span>Loading more...</span>
              </>
            ) : (
              <span>Load earlier activity</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
