"use client";
import { ReadFeedback } from "@/components/ui/read-feedback";

import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useCircle } from "@/lib/context/circle-context";
import { sheetHref } from "@/lib/navigation/sheet-routes";
import { CirclePageHeader } from "./circle-page-header";

export function CircleFullList({ circleId, view, accountId }: { circleId: string; view: "members" | "cafes"; accountId?: string }) {
  const context = useCircle();
  if (accountId !== undefined && context.accountId !== accountId) return <p role="status" className="p-6">This Circle is unavailable.</p>;
  const allowed = !!context.accountId && context.membershipsResolved && context.activeCircle?.id === circleId && context.userCircles.some(circle => circle.id === circleId);
  const members = allowed ? [...context.circleMembers].sort((a, b) =>
    Number(b.userId === context.accountId) - Number(a.userId === context.accountId) || a.displayName.localeCompare(b.displayName) || a.userId.localeCompare(b.userId)) : [];
  const cafes = allowed ? context.circleSavedCafes.filter(cafe => cafe.group_id === circleId).sort((a, b) =>
    (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0) || a.id.localeCompare(b.id)) : [];
  const hasRows = view === "members" ? members.length > 0 : cafes.length > 0;
  const rowClass = "flex min-h-11 min-w-0 items-center gap-3 rounded py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

  return <div className="mx-auto max-w-2xl px-4 pt-6 pb-28 text-foreground">
    <CirclePageHeader circleId={circleId} title={view === "members" ? "Members" : "Circle cafés"}/>
    {allowed && <>
      {context.error && hasRows && <div className="mb-4"><p role="alert">{context.error}</p><button type="button" onClick={() => { void context.refreshCircleData().catch(() => undefined); }} className="min-h-11 rounded px-2 text-sm font-medium underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Try again</button></div>}
      {!hasRows ? context.isLoading || context.error ? <ReadFeedback pending={context.isLoading} error={context.error} operationKey={`circle-list:${context.accountId}:${circleId}:${view}`} label={`Loading ${view === "members" ? "members" : "cafés"}…`} retry={context.refreshCircleData}/> : <p className="text-muted-foreground">{view === "members" ? "No members available." : "No Circle cafés yet."}</p>
        : <ul className="divide-y divide-border">
          {view === "members" ? members.map(member => <li key={member.userId}>
            <Link href={member.userId === context.accountId ? "/profile" : sheetHref({ kind: "member", root: "nearby", entityId: member.userId, circleId })} className={rowClass}>
              <UserAvatar name={member.displayName} src={member.avatarUrl} decorative fallback={member.displayName.slice(0, 1)} className="size-9 bg-surface-elevated font-semibold"/>
              <span className="min-w-0 break-words font-medium">{member.displayName}{member.userId === context.accountId && <span className="ml-2 text-sm text-muted-foreground">You</span>}</span>
            </Link>
          </li>) : cafes.map(cafe => <li key={cafe.id}>
            <Link href={sheetHref({ kind: "cafe", root: "nearby", entityId: cafe.cafe_id, circleId })} className={rowClass}>
              <span className="min-w-0 break-words"><span className="block font-medium">{cafe.cafe_name || "Café"}</span>{cafe.cafe_address && <span className="block text-sm text-muted-foreground">{cafe.cafe_address}</span>}</span>
            </Link>
          </li>)}
        </ul>}
    </>}
  </div>;
}
