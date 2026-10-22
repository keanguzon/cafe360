"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import { useState } from "react";
import { createGroupAction, joinGroupViaInviteAction } from "@/lib/actions/group-actions";
import { useCircle } from "@/lib/context/circle-context";
import { isOnline, OFFLINE_MUTATION_MESSAGE, useOnlineStatus } from "@/lib/hooks/use-online-status";
import type { SheetContentProps } from "./profile-content";
export function CircleFormContent({view,onOpen}:SheetContentProps & {view:"circle-create"|"circle-join"}) {
 const [value,setValue]=useState("");
 const [error,setError]=useState<string|null>(null);
 const [pending,setPending]=useState(false);
 const [committedId,setCommittedId]=useState<string|null>(null);
 const online=useOnlineStatus();
 const {accountId,refreshMemberships,setActiveCircleId}=useCircle();
 async function refresh(groupId:string) {
  try {
   const memberships=await refreshMemberships();
   if(!memberships.some(circle=>circle.id===groupId)) throw new Error("Membership not available yet");
   setActiveCircleId(groupId);
   onOpen({kind:"circle",root:"nearby",entityId:groupId});
  } catch { setError("Circle saved, but the list could not refresh. Retry the refresh to continue."); }
 }
 return <form className="space-y-4 p-4" onSubmit={async event=>{
  event.preventDefault();
  if(!isOnline()){setError(OFFLINE_MUTATION_MESSAGE);return;}
  if(pending)return;
  setPending(true);setError(null);
  try {
   if(committedId){await refresh(committedId);return;}
   const result=view==="circle-create"?await createGroupAction({name:value}):await joinGroupViaInviteAction(value);
   if(!result.success || !result.groupId){setError(result.error??"Could not update Circle.");return;}
   setCommittedId(result.groupId);
   await refresh(result.groupId);
  }catch{setError("Could not update Circle. Please retry.");}finally{setPending(false);}
 }}>
 <h1 className="text-xl font-semibold">{view==="circle-create"?"Create Circle":"Join Circle"}</h1>
 <label className="block">{view==="circle-create"?"Circle name":"Invite code"}<input disabled={!!committedId} value={value} onChange={event=>setValue(event.target.value)} required maxLength={100} className="mt-2 block min-h-11 w-full rounded border border-border bg-background px-3 text-base"/></label>
 {error&&<p role="alert">{error}</p>}
 <button disabled={pending||!online} className="min-h-11 rounded bg-accent px-4 text-accent-foreground">{pending?"Saving…":committedId?"Retry refresh":view==="circle-create"?"Create Circle":"Join Circle"}</button>
 <ActionFeedback pending={pending} operationKey={`circle-form:${accountId}:${view}`} label="Saving Circle…" />
      </form>;
}
