import { Suspense, type ReactNode } from "react";
import { MapShell } from "@/components/map/map-shell";
import { MapShellMount } from "@/lib/context/map-shell-presence";
import { SheetNavigationProvider } from "@/lib/context/sheet-navigation";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function MapLayout({children,sheet}:{children:ReactNode;sheet:ReactNode}) {
 let accountId="development-preview";
 let avatar:string|null=null;
 if(hasSupabaseConfig()) {
  const client=await createClient(); const {data:{user}}=await client.auth.getUser();
  if(!user)redirect('/login?next=%2Fmap');
  accountId=user.id; avatar=user.user_metadata?.avatar_url??null;
 }
 return <Suspense fallback={<p role="status">Loading map…</p>}><MapShellMount><SheetNavigationProvider accountId={accountId}><MapShell accountId={accountId} userAvatarUrl={avatar}/>{children}{sheet}</SheetNavigationProvider></MapShellMount></Suspense>;
}
