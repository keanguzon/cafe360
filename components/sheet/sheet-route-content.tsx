"use client";
import { useCallback, useEffect, useState } from "react";
import type { SheetRoute } from "@/lib/navigation/sheet-routes";
import { useSheetNavigation } from "@/lib/context/sheet-navigation";
import { useCircle } from "@/lib/context/circle-context";
import { CafeContent } from "./cafe-content";
import { MemoryContent } from "./memory-content";
import { ProfileContent } from "./profile-content";
import { SettingsContent } from "./settings-content";
import { CircleFormContent } from "./circle-form-content";
import { CircleContent } from "./circle-content";
import { CollectionView } from "@/components/cafe/collection-view";
export function SheetRouteContent({route,active}:{route:SheetRoute;active:boolean}) {
 const {accountId}=useCircle(); const navigation=useSheetNavigation(); const [dirty,setDirty]=useState(false);
 const {registerDirty}=navigation;
 const onDirtyChange=useCallback((value:boolean)=>setDirty(value),[]);
 useEffect(()=>registerDirty("nested-visit",dirty),[registerDirty,dirty]);
 const props={accountId,circleId:route.circleId??(["activity","memories","circle"].includes(route.kind)?route.entityId:undefined),presentation:"sheet" as const,onOpen:(next:SheetRoute)=>{void navigation.open(next);},onBack:()=>{void navigation.back();}};
 if(!active) return null;
 switch(route.kind) {
 case "cafe":case "cafe-memories":case "visit": return <CafeContent key={`${accountId}:${route.circleId}:${route.entityId}:${route.kind}`} {...props} cafeId={route.entityId!} view={route.kind} active={active} onDirtyChange={onDirtyChange}/>;
 case "memory":return <MemoryContent {...props} visitId={route.entityId!} active={active}/>;
 case "member":case "you":return <ProfileContent {...props} userId={route.kind==="member"?route.entityId:undefined} edit={route.edit} active={active} onDirtyChange={onDirtyChange}/>;
 case "circle-create":case "circle-join":return <CircleFormContent {...props} view={route.kind}/>;
 case "settings":return <SettingsContent {...props}/>;
 case "collection":return <CollectionView collectionName={route.entityId!} presentation="sheet" onOpen={props.onOpen} onBack={props.onBack}/>;
 case "circles":case "circle":case "activity":case "memories":return <CircleContent {...props} circleId={props.circleId} view={route.kind} active={active}/>;
 default:return <p role="status">This view is unavailable.</p>;
 }
}
