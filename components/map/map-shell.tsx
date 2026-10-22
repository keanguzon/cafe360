"use client";
import { ReadFeedback } from "@/components/ui/read-feedback";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useCircle } from "@/lib/context/circle-context";
import { useNavigationState, type CircleSheetState } from "@/lib/context/navigation-state";
import { useSheetNavigation } from "@/lib/context/sheet-navigation";
import { sheetHref } from "@/lib/navigation/sheet-routes";
import { MapSheetHost, type MapSheetSnap } from "@/components/layout/map-sheet-host";
import { CircleOverview } from "@/components/circle/circle-overview";
import { SheetRouteContent } from "@/components/sheet/sheet-route-content";
import { getCafeByReferenceAction } from "@/lib/actions/cafe-details-actions";
import type { CafeSearchResult } from "@/lib/types/places";
import { MapView } from "./map-view";
import { unstable_serialize, useSWRConfig } from "swr";
export function MapShell(props:{accountId:string;userAvatarUrl:string|null}) {return <AccountMapShell key={props.accountId} {...props}/>;}
function AccountMapShell({accountId,userAvatarUrl}:{accountId:string;userAvatarUrl:string|null}) {
 const navigation=useSheetNavigation();const context=useCircle();const retained=useNavigationState();
 const {cache}=useSWRConfig();
 const current=useRef(context);
 useLayoutEffect(()=>{current.current=context;},[context]);
 const alive=useRef(true);
 const returnFocus=useRef<HTMLElement|null>(null);
 const wasNested=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const [floatingTarget,setFloatingTarget]=useState<HTMLDivElement|null>(null);
 const [focusRequest,setFocusRequest]=useState<{cafe:CafeSearchResult;sequence:number}|null>(null);
 const [snap,setSnap]=useState<MapSheetSnap>('half');
 const previewAttempt=useRef(0);
 const [previewRead,setPreviewRead]=useState<{circleId:string;cafeId:string;attempt:number;routeKey:string}|null>(null);
 const circle=context.activeCircle;
 const authorized=context.accountId===accountId&&context.membershipsResolved&&!!circle&&context.userCircles.some(item=>item.id===circle.id);
 const route=navigation.activeRoute;
 const routeKey=route?sheetHref(route):'';
 useLayoutEffect(()=>{
  previewAttempt.current++;
  // A preview belongs to the destination that requested it, including return navigation.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  setPreviewRead(null);
 },[accountId,circle?.id,routeKey]);
 const nested=authorized&&!!route&&['cafe','cafe-memories','visit','memory'].includes(route.kind)&&route.circleId===circle.id;
 useLayoutEffect(()=>{if(wasNested.current&&!nested&&returnFocus.current?.isConnected)returnFocus.current.focus();wasNested.current=nested;},[nested]);
 const rememberFocus=()=>{if(document.activeElement instanceof HTMLElement)returnFocus.current=document.activeElement;};
 const {getSnapshot,update}=retained;
 useEffect(()=>{
  if(context.accountId!==accountId||!context.membershipsResolved)return;
  const existing=getSnapshot().circleSheets;
  const kept=Object.fromEntries(Object.entries(existing).filter(([id])=>context.userCircles.some(item=>item.id===id)));
  if(Object.keys(kept).length!==Object.keys(existing).length)update({circleSheets:kept});
 },[accountId,context.accountId,context.membershipsResolved,context.userCircles,getSnapshot,update]);
 const saveView=useCallback((view:CircleSheetState)=>{
  const live=current.current;
  if(!circle||live.accountId!==accountId||!live.membershipsResolved||live.activeCircle?.id!==circle.id||!live.userCircles.some(item=>item.id===circle.id))return;
  const previous=getSnapshot().circleSheets;
  if(previous[circle.id]?.scrollTop===view.scrollTop&&previous[circle.id]?.snap===view.snap)return;
  update({circleSheets:{...previous,[circle.id]:view}});
 },[circle,accountId,getSnapshot,update]);
 const openCafe=async(cafe:CafeSearchResult)=>{
  if(!authorized)return;
  rememberFocus();
  if(await navigation.open({kind:'cafe',root:'nearby',entityId:cafe.id,circleId:circle.id}))setFocusRequest(previous=>({cafe,sequence:(previous?.sequence??0)+1}));
 };
 const openPreviewCafe=async(id:string)=>{
  if(!authorized)return;const scope=circle.id;const attempt=++previewAttempt.current;
  const providerId=context.circleCafeSummaries?.find(item=>item.internalId===id)?.providerId;
  for(const reference of providerId?[id,providerId]:[id]){
   const entry=cache.get(unstable_serialize(["sheet-cafe",accountId,scope,reference]));
   const cached=entry?.data as CafeSearchResult|undefined;
   if(!entry?.error&&cached?.id&&cached.name&&Array.isArray(cached.coordinates)){
    setPreviewRead(null);await openCafe(cached);return;
   }
  }
  setPreviewRead({circleId:scope,cafeId:id,attempt,routeKey});
  try {
   const cafe=await getCafeByReferenceAction({kind:'internal',id},accountId);
   const live=current.current;
   if(alive.current&&previewAttempt.current===attempt&&live.accountId===accountId&&live.activeCircle?.id===scope&&live.membershipsResolved&&live.userCircles.some(item=>item.id===scope)){
    if(cafe)await openCafe(cafe);else void navigation.open({kind:'cafe',root:'nearby',entityId:id,circleId:scope});
   }
  }catch{const live=current.current;if(alive.current&&previewAttempt.current===attempt&&live.accountId===accountId&&live.membershipsResolved&&live.activeCircle?.id===scope&&live.userCircles.some(item=>item.id===scope))void navigation.open({kind:'cafe',root:'nearby',entityId:id,circleId:scope});}
  finally{if(alive.current&&previewAttempt.current===attempt)setPreviewRead(null);}
 };
 const initial=authorized?retained.circleSheets[circle.id]:undefined;
 return <div className="relative h-full min-h-0 w-full overflow-hidden bg-background">
  <div className="absolute inset-0" inert={snap==='full'} aria-hidden={snap==='full'||undefined}>
   <MapView shellMode floatingActionsTarget={floatingTarget} userAvatarUrl={userAvatarUrl} onCafeOpen={cafe=>{void openCafe(cafe);}} focusRequest={focusRequest}
    onVisitOpen={cafe=>{if(authorized){rememberFocus();void navigation.open({kind:'visit',root:'nearby',entityId:cafe.id,circleId:circle.id});}}}
    beforeCircleOpen={navigation.confirmLeave}
    onActivityOpen={()=>{if(authorized)void navigation.open({kind:'activity',root:'nearby',entityId:circle.id});}}/>
  </div>
  <MapSheetHost key={authorized?circle.id:'unavailable'} initialScrollTop={initial?.scrollTop} initialSnap={initial?.snap} onViewStateChange={saveView} contentKey={nested?sheetHref(route!):'overview'} nested={nested} onBack={()=>{void navigation.back();}} onSnapChange={setSnap} circleLoading={!context.membershipsResolved} circleName={authorized?circle.name:undefined} memberCount={authorized?(context.isLoading?circle.member_count:context.circleMembers.length):0} floatingActions={<div ref={setFloatingTarget}/>}>
   {authorized&&previewRead?.circleId===circle.id&&previewRead.routeKey===routeKey&&<ReadFeedback pending operationKey={`preview-cafe:${accountId}:${circle.id}:${previewRead.cafeId}:${previewRead.attempt}`} label="Loading café…"/>}
   {authorized?<><div hidden={nested} inert={nested}><CircleOverview active={!nested} onOpenCafe={id=>{void openPreviewCafe(id);}} onOpenMemory={id=>{rememberFocus();void navigation.open({kind:'memory',root:'nearby',entityId:id,circleId:circle.id});}}/></div>
    {nested&&route&&<SheetRouteContent key={`${accountId}:${circle.id}:${route.kind}:${route.entityId}`} route={route} active/>}</>:context.membershipsResolved?<p role="status" className="py-3 text-sm text-muted-foreground">Select an available Circle to continue.</p>:<ReadFeedback pending error={context.error} operationKey={`map-memberships:${accountId}`} label="Loading Circle…" retry={context.refreshMemberships}/>}
  </MapSheetHost>
 </div>;
}
