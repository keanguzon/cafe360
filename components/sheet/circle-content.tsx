"use client";
import { ReadFeedback } from "@/components/ui/read-feedback";
import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { useRouter } from "@/components/navigation/router";
import type { MouseEvent } from "react";
import { FriendsHubClient } from "@/app/(main)/circles/friends-hub-client";
import { GroupDetailClient } from "@/app/(main)/circles/[groupId]/group-detail-client";
import { VisitTimeline } from "@/components/visit/visit-timeline";
import { ActivityFeed } from "@/components/social/activity-feed";
import { CirclePageHeader } from "@/components/circle/circle-page-header";
import { useCircle } from "@/lib/context/circle-context";
import { useCircleData } from "@/lib/hooks/use-circle-data";
import { useSheetResource, unwrapSheetRead } from "@/lib/hooks/use-sheet-resource";
import { readSheetCircleAction } from "@/lib/actions/sheet-read-actions";
import { parseSheetRoute, sheetHref } from "@/lib/navigation/sheet-routes";
import type { GroupWithMembers } from "@/lib/types/social";
import type { SheetContentProps } from "./profile-content";
export function CircleContent({ accountId, circleId, presentation, onOpen, onBack, view = "circles", active = true }: SheetContentProps & {
    view?: "circles" | "circle" | "activity" | "memories";
    active?: boolean;
}) {
    const context = useCircle();
    const scoped = view !== "circles";
    const allowed = !!accountId && context.accountId === accountId && (!scoped || (!!circleId && context.membershipsResolved && context.activeCircle?.id === circleId && context.userCircles.some(circle => circle.id === circleId)));
    const pageTimeline = presentation === "page" && (view === "activity" || view === "memories");
    const snapshot = useCircleData(accountId, allowed && scoped ? circleId! : null);
    const detail = useSheetResource<GroupWithMembers>(allowed && view === "circle" ? ["sheet-circle", accountId, circleId!] : null, async () => unwrapSheetRead(await readSheetCircleAction({ expectedAccountId: accountId, circleId: circleId! })), active);
    const navigateLink = (event: MouseEvent<HTMLDivElement>) => {
        if (presentation !== "sheet" || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
            return;
        const anchor = (event.target as Element).closest("a");
        if (!anchor || anchor.target || anchor.hasAttribute("download"))
            return;
        const url = new URL(anchor.href, window.location.href);
        if (url.origin !== window.location.origin)
            return;
        const route = parseSheetRoute(url.pathname, url.searchParams);
        if (route) {
            event.preventDefault();
            onOpen(route);
        }
    };
    if (pageTimeline && circleId && context.accountId === accountId && !allowed && !snapshot.accessRevoked)
        return <div className="mx-auto max-w-2xl px-4 pt-6 pb-28"><CirclePageHeader circleId={circleId} title={view === "activity" ? "Activity" : "Memories"}/></div>;
    if (!allowed || snapshot.accessRevoked)
        return <p role="status" className="p-6">This Circle is unavailable.</p>;
    const memories = !snapshot.hasData && (snapshot.initialLoading || snapshot.error)
        ? <ReadFeedback pending={active && snapshot.initialLoading} error={snapshot.error} operationKey={`circle-memories:${accountId}:${circleId}`} label="Loading memories…" retry={snapshot.refresh}/>
        : <VisitTimeline visits={snapshot.visits} onOpen={onOpen}/>;
    return <div onClick={navigateLink}>
    {presentation === "page" && !pageTimeline && <Link href="/map" className="inline-flex min-h-11 items-center px-4 text-sm font-medium">Return to map</Link>}
    {view === "circles" ? presentation === "sheet" ? <div className="space-y-4 p-4"><h1 className="text-xl font-semibold">Your Circles</h1>{context.userCircles.map(circle=><div key={circle.id} className="flex items-center gap-3"><button className="min-h-11 underline text-sm font-medium" onClick={()=>context.setActiveCircleId(circle.id)}>{circle.name}{context.activeCircle?.id===circle.id?" (selected)":""}</button><button className="min-h-11 underline text-sm font-medium" onClick={()=>{context.setActiveCircleId(circle.id);onOpen({kind:"circle",root:"nearby",entityId:circle.id});}}>Manage</button></div>)}<Link className="inline-flex min-h-11 items-center px-3 underline text-sm font-medium" href="/circles/groups/new">Create Circle</Link><Link className="inline-flex min-h-11 items-center px-3 underline text-sm font-medium" href="/circles?join=1">Join Circle</Link></div> : <FriendsHubClient initialGroups={[]}/> : view === "circle" ?
            detail.data ? <GroupDetailClient group={detail.data} saves={snapshot.savedCafes} presentation={presentation} onOpen={onOpen} onBack={onBack}/> :
                <ReadFeedback pending={active && detail.initialLoading} error={detail.error} operationKey={`circle:${accountId}:${circleId}`} label="Loading Circle…" retry={detail.refresh} className="p-6"/> :
            <div className="mx-auto max-w-2xl px-4 pt-6 pb-28">{pageTimeline ? <CirclePageHeader circleId={circleId!} title={view === "activity" ? "Activity" : "Memories"}/> : <><button className="min-h-11 text-sm font-medium" onClick={onBack}>Back to Circle</button><h1 className="mb-6 text-xl font-bold">{context.userCircles.find(c => c.id === circleId)?.name} {view === "activity" ? "Activity" : "Memories"}</h1></>}<nav aria-label="Circle feed views" className="mb-4 flex gap-4">{(["activity","memories"] as const).map(feed=><Link key={feed} className="inline-flex min-h-11 items-center underline text-sm font-medium" aria-current={view===feed?"page":undefined} href={sheetHref({kind:feed,root:"nearby",entityId:circleId})}>{feed==="activity"?"Activity":"Memories"}</Link>)}</nav>{view === "memories" ? memories : <ActivityFeed groupId={circleId} onOpen={onOpen}/>}</div>}
  </div>;
}
export function StandaloneCircleContent(props: {
    accountId?: string;
    circleId?: string;
    view?: "circles" | "circle" | "activity" | "memories";
}) {
    const router = useRouter();
    const context = useCircle();
    return <CircleContent {...props} accountId={props.accountId ?? context.accountId} presentation="page" onOpen={route => router.push(sheetHref(route))} onBack={() => router.push(props.circleId ? `/circles/${encodeURIComponent(props.circleId)}` : "/map")}/>;
}
