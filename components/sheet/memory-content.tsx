"use client";
import { ReadFeedback } from "@/components/ui/read-feedback";
import { useRouter } from "@/components/navigation/router";
import { sheetHref } from "@/lib/navigation/sheet-routes";
import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { MemoryCard } from "@/components/visit/memory-card";
import { useCircle } from "@/lib/context/circle-context";
import { readSheetMemoryAction } from "@/lib/actions/sheet-read-actions";
import { useSheetResource, unwrapSheetRead } from "@/lib/hooks/use-sheet-resource";
import type { VisitWithDetails } from "@/lib/types/visit";
import type { SheetContentProps } from "./profile-content";
export function MemoryContent({ accountId, circleId, visitId, presentation, onBack, active = true }: SheetContentProps & {
    visitId: string;
    active?: boolean;
}) {
    const context = useCircle();
    const allowed = context.accountId === accountId && !!circleId && context.membershipsResolved && context.activeCircle?.id === circleId;
    const memory = useSheetResource<VisitWithDetails>(allowed ? ["sheet-memory", accountId, circleId!, visitId] : null, async () => unwrapSheetRead(await readSheetMemoryAction({ expectedAccountId: accountId, circleId: circleId!, visitId })), active);
    if (!allowed)
        return <p role="status" className="p-6">This Circle memory is unavailable.</p>;
    return <div className="mx-auto max-w-2xl space-y-4 p-4 pb-28">
    {presentation === "page" ? <Link href="/map" className="inline-flex min-h-11 items-center text-sm font-medium">Return to map</Link> : <button onClick={onBack} className="min-h-11 text-sm font-medium">Back</button>}
    <h1 className="text-xl font-semibold">Memory</h1>
    {!memory.data && <ReadFeedback pending={active && memory.initialLoading} error={memory.error} operationKey={`memory:${accountId}:${circleId}:${visitId}`} label="Loading memory…" retry={memory.refresh}/>}
    {memory.data && memory.data.group_id !== circleId && <p role="status">This Circle memory is unavailable.</p>}
    {memory.data?.group_id === circleId && <MemoryCard visit={memory.data}/>}
  </div>;
}

export function StandaloneMemoryContent({visitId,circleId}:{visitId:string;circleId?:string}) { const context=useCircle(); const router=useRouter(); return <MemoryContent accountId={context.accountId} visitId={visitId} circleId={circleId} presentation="page" onOpen={route=>router.push(sheetHref(route))} onBack={()=>router.push("/map")}/>; }
