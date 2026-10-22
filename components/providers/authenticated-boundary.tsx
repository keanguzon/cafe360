"use client";

import { useEffect, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "@/components/navigation/router";
import { useSWRConfig } from "swr";
import { createClient } from "@/lib/supabase/client";

export function AuthenticatedBoundary({accountId,enabled,children}:{accountId:string;enabled:boolean;children:ReactNode}) {
 return <AccountBoundary key={accountId} accountId={accountId} enabled={enabled}>{children}</AccountBoundary>;
}
function AccountBoundary({accountId,enabled,children}:{accountId:string;enabled:boolean;children:ReactNode}) {
 const [invalidated,setInvalidated]=useState(false);
 const {cache}=useSWRConfig();
 const {replace,refresh}=useRouter();
 useEffect(()=>{
  if(!enabled)return;
  let departed=false;
  const client=createClient();
  const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{
   if(departed||session?.user.id===accountId)return;
   departed=true;
   for(const key of cache.keys())cache.delete(key);
   // Remove all retained forms/media before the server refresh can reveal a new account.
   flushSync(()=>setInvalidated(true));
   if(!session)replace("/login");
   refresh();
  });
  return ()=>{departed=true;subscription.unsubscribe();};
 },[accountId,enabled,cache,replace,refresh]);
 return invalidated?<p role="status">Updating session…</p>:children;
}
