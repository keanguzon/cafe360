"use client";
import { ReadFeedback } from "@/components/ui/read-feedback";
import { useRouter } from "@/components/navigation/router";
import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { useSWRConfig } from "swr";
import type { CafeSearchResult } from "@/lib/types/places";
import { CafeDetailContent } from "@/components/cafe/cafe-detail-content";
import { VisitTimelineFetcher } from "@/components/visit/visit-timeline-fetcher";
import { LogVisitForm } from "@/components/visit/log-visit-form";
import { getCafeByReferenceAction } from "@/lib/actions/cafe-details-actions";
import { useSheetResource } from "@/lib/hooks/use-sheet-resource";
import { useCircle } from "@/lib/context/circle-context";
import { HttpResponseError } from "@/components/providers/swr-provider";
import { sheetHref } from "@/lib/navigation/sheet-routes";
import type { SheetContentProps } from "./profile-content";
export function CafeContent({accountId,circleId,cafeId,view="cafe",presentation,onOpen,onBack,active=true,onDirtyChange}: SheetContentProps & {cafeId:string;view?:"cafe"|"cafe-memories"|"visit";active?:boolean;onDirtyChange?:(dirty:boolean)=>void}) {
 const context=useCircle();
 const {cache}=useSWRConfig();
 const allowed=context.accountId===accountId && (!circleId || (context.membershipsResolved && context.activeCircle?.id===circleId));
 const resource=useSheetResource(allowed ? ["sheet-cafe",accountId,circleId??"",cafeId] : null,async()=>{
  // Search results can be opened before a save or visit creates a canonical row.
  for(const key of cache.keys()){
   const entry=cache.get(key);
   const source=(entry as { _k?:unknown }|undefined)?._k;
   if(entry?.error||!Array.isArray(source)||source[0]!==accountId||typeof source[1]!=="string"||!source[1].startsWith("/api/places/search?"))continue;
   const search=entry?.data as {results?:CafeSearchResult[]}|undefined;
   const selected=search?.results?.find(cafe=>cafe.id===cafeId);
   if(selected)return selected;
  }
  const cafe=await getCafeByReferenceAction({kind:/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(cafeId)?"internal":"provider",id:cafeId},accountId);
  if(!cafe) throw new HttpResponseError("This café is unavailable.",404);
  return cafe;
 },active);
 if(!allowed || (view!=="cafe" && !context.activeCircle)) return <p role="status" className="p-6">This café is unavailable in the selected Circle. Select the requested Circle to continue.</p>;
 return <div className="p-4 pb-20">{presentation==="page" && <Link className="inline-flex min-h-11 items-center text-sm font-medium" href="/map">Return to map</Link>}
 {!resource.data && <ReadFeedback pending={active && resource.initialLoading} error={resource.error} operationKey={`cafe:${accountId}:${circleId ?? ""}:${cafeId}`} label="Loading café…" retry={resource.refresh}/>}
 {resource.data && (view==="visit" ? <LogVisitForm cafe={resource.data} onSuccess={onBack} onDirtyChange={onDirtyChange}/> : view==="cafe-memories" ? <><h1 className="text-xl font-semibold">{resource.data.name} memories</h1><VisitTimelineFetcher cafeId={resource.data.id} groupId={context.activeCircle!.id} onOpen={onOpen}/></> : <CafeDetailContent cafe={resource.data} onOpen={onOpen} active={active}/>)}
 </div>;
}
export function StandaloneCafeContent({cafeId,circleId,view}: {cafeId:string;circleId?:string;view?:"cafe"|"cafe-memories"|"visit"}) {const router=useRouter();const context=useCircle();return <CafeContent accountId={context.accountId} cafeId={cafeId} circleId={circleId} view={view} presentation="page" onOpen={route=>router.push(sheetHref(route))} onBack={()=>router.push(sheetHref({kind:"cafe",root:"nearby",entityId:cafeId,circleId}))}/>;}
