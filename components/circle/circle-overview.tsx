"use client";
import { ReadFeedback } from "@/components/ui/read-feedback";

import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import type { ReactNode } from "react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useCircle } from "@/lib/context/circle-context";
import { useCircleActivity } from "@/lib/hooks/use-circle-activity";
import { sheetHref } from "@/lib/navigation/sheet-routes";
import { ActivityItem } from "@/components/social/activity-item";
import { PrivatePhoto } from "@/components/visit/private-photo";
import { CircleSectionNav } from "@/components/layout/circle-section-nav";

export const CIRCLE_PREVIEW_LIMIT = 2;
type CircleOverviewProps = {
  active: boolean;
  onOpenCafe(cafeId: string): void;
  onOpenMemory(visitId: string): void;
};
const rowClass = "flex min-h-11 w-full min-w-0 items-center gap-3 rounded-lg py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
function newest<T extends { id: string }>(items: T[], date: (item: T) => string) {
  const timestamp = (item: T) => Date.parse(date(item)) || 0;
  return [...items].sort((a, b) => timestamp(b) - timestamp(a) || a.id.localeCompare(b.id)).slice(0, CIRCLE_PREVIEW_LIMIT);
}
function PreviewSection({ title, label, href, hasContent, loading, error, retry, empty, children, operationKey }: {
  title: string; label: string; href?: string; hasContent: boolean; loading: boolean;
  error: string | null; retry(): Promise<unknown>; empty: string; children: ReactNode;
  operationKey: string;
}) {
  return <section data-circle-section={title === "Circle cafés" ? "cafes" : title.toLowerCase()} aria-label={title} className="border-t border-border py-3 first:border-t-0">
    <div className="flex min-h-11 items-center justify-between gap-3">
      <h3 className="font-semibold text-foreground">{title}</h3>
      {hasContent && href && <Link href={href} aria-label={`See all ${label}`} className="inline-flex min-h-11 shrink-0 items-center rounded px-2 text-sm text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent font-medium">See all</Link>}
    </div>
    {error && hasContent && <div className="flex flex-wrap items-center gap-x-2 text-sm">
      <p role="alert" className="text-foreground">{error}</p>
      <button type="button" aria-label={`Retry ${label}`} onClick={() => { void retry().catch(() => undefined); }} className="min-h-11 rounded px-2 text-sm font-medium underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Retry</button>
    </div>}
    {hasContent ? children : loading || error ? <ReadFeedback pending={loading} error={error} operationKey={`${operationKey}:${label}`} label={`Loading ${label}…`} retry={retry}/> : <p className="py-2 text-sm text-muted-foreground">{empty}</p>}
  </section>;
}

export function CircleOverview({ active, onOpenCafe, onOpenMemory }: CircleOverviewProps) {
  const context = useCircle();
  const circle = context.activeCircle;
  const allowed = !!context.accountId && context.membershipsResolved && !!circle && context.userCircles.some(item => item.id === circle.id);
  const feed = useCircleActivity(context.accountId, active && allowed ? circle.id : null);
  if (!active) return null;
  if (!allowed) return context.membershipsResolved ? <p role="status" className="py-3 text-sm text-muted-foreground">Select an available Circle to see its overview.</p> : <ReadFeedback pending error={context.error} operationKey={`memberships:${context.accountId}`} label="Loading Circle…" retry={context.refreshMemberships}/>;

  const own = context.circleMembers.find(member => member.userId === context.accountId);
  const others = context.circleMembers.filter(member => member.userId !== context.accountId)
    .sort((a, b) => a.displayName.localeCompare(b.displayName) || a.userId.localeCompare(b.userId));
  const members = own ? [own, ...others] : others;
  const saves = newest(context.circleSavedCafes.filter(save => save.group_id === circle.id), save => save.created_at);
  const memories = newest(context.circleVisits.filter(visit => visit.group_id === circle.id), visit => visit.visited_at);
  const activities = newest(feed.activities.filter(activity => activity.group_id === circle.id), activity => activity.created_at);
  const base = `/circles/${encodeURIComponent(circle.id)}`;
  const operationKey = `overview:${context.accountId}:${circle.id}`;
  const sharedStatus = { operationKey, loading: context.isLoading, error: context.error, retry: context.refreshCircleData };

  return <div aria-label={`${circle.name} overview`} className="min-w-0 text-foreground">
    <CircleSectionNav key={circle.id}/>
    <PreviewSection title="Members" label="members" hasContent={members.length > 0} {...sharedStatus} empty="No members available.">
      <div className="divide-y divide-border">
        {members.map(member => <Link key={member.userId} data-testid="circle-member-preview" href={member.userId === context.accountId ? "/profile" : sheetHref({ kind: "member", root: "nearby", entityId: member.userId, circleId: circle.id })} className={rowClass}>
          <UserAvatar name={member.displayName} src={member.avatarUrl} decorative fallback={member.displayName.slice(0, 1)} className="size-9 bg-surface-elevated text-sm font-semibold"/>
          <span className="min-w-0 break-words text-sm font-medium">{member.displayName}{member.userId === context.accountId && <span className="ml-2 text-xs text-muted-foreground">You</span>}</span>
        </Link>)}
      </div>
    </PreviewSection>
    <PreviewSection title="Circle cafés" label="cafés" href={`${base}/cafes`} hasContent={saves.length > 0} {...sharedStatus} empty="No Circle cafés yet.">
      <div className="divide-y divide-border">{saves.map(save => <button type="button" key={save.id} data-testid="circle-cafe-preview" onClick={() => onOpenCafe(save.cafe_id)} className={rowClass}>
        <span className="min-w-0"><span className="block truncate text-sm font-medium">{save.cafe_name || "Café"}</span>{save.cafe_address && <span className="block truncate text-xs text-muted-foreground">{save.cafe_address}</span>}</span>
      </button>)}</div>
    </PreviewSection>
    <PreviewSection title="Activity" label="activity" operationKey={operationKey} href={`${base}/timeline?view=activity`} hasContent={activities.length > 0} loading={feed.initialLoading} error={feed.error} retry={feed.refresh} empty="No activity yet.">
      <div className="space-y-2">{activities.map(activity => {
        const content = <ActivityItem activity={activity} compact/>;
        return activity.visit_id || activity.cafe_id ? <button type="button" key={activity.id} data-testid="circle-activity-preview" onClick={() => { if (activity.visit_id) onOpenMemory(activity.visit_id); else if (activity.cafe_id) onOpenCafe(activity.cafe_id); }} className={`${rowClass} block p-0`}>{content}</button> : <div key={activity.id} data-testid="circle-activity-preview">{content}</div>;
      })}</div>
    </PreviewSection>
    <PreviewSection title="Memories" label="memories" href={`${base}/timeline?view=memories`} hasContent={memories.length > 0} {...sharedStatus} empty="No memories yet.">
      <div className="divide-y divide-border">{memories.map(memory => <div key={memory.id} data-testid="circle-memory-preview" className="flex min-w-0 items-center gap-3 py-2">
        {memory.photos?.[0] && <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-surface-elevated"><PrivatePhoto path={memory.photos[0].storage_path} groupId={circle.id}/></div>}
        <button type="button" onClick={() => onOpenMemory(memory.id)} className={`${rowClass} flex-1 flex-col items-start justify-center gap-1`}>
          <span className="text-sm font-medium">{memory.cafe?.name || "Café visit"}</span>
          <time dateTime={memory.visited_at} className="text-xs text-muted-foreground">{memory.visited_at.slice(0, 10)}</time>
          {memory.notes && <span className="line-clamp-2 break-words text-sm text-muted-foreground">{memory.notes}</span>}
        </button>
      </div>)}</div>
    </PreviewSection>
  </div>;
}
