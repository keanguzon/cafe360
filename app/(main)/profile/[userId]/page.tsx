import { notFound, redirect } from "next/navigation";
import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { readSheetProfileAction } from "@/lib/actions/sheet-read-actions";
import { StandaloneProfileContent } from "@/components/sheet/profile-content";

export const metadata = { title: "Circle member — Cafe360" };
export default async function MemberProfilePage({ params, searchParams }: {
  params: Promise<{userId:string}>;
  searchParams: Promise<{circle?:string|string[]}>;
}) {
  const {userId}=await params;
  const search=await searchParams;
  const circleId=typeof search.circle === "string" ? search.circle : undefined;
  if (!circleId) notFound();
  if (!hasSupabaseConfig()) return <p className="p-6">Circle profiles require a connected account. <Link href="/map">Return to map</Link></p>;
  const client=await createClient();
  const {data:{user}}=await client.auth.getUser();
  if(!user) redirect("/login?next="+encodeURIComponent("/profile/"+encodeURIComponent(userId)+"?"+new URLSearchParams({circle:circleId})));
  const result=await readSheetProfileAction({expectedAccountId:user.id,userId,circleId});
  if(!result.ok) return <p role="status" className="p-6">{result.error} <Link href="/map">Return to map</Link></p>;
  return <StandaloneProfileContent accountId={user.id} userId={userId} circleId={circleId} initialProfile={result.data}/>;
}
