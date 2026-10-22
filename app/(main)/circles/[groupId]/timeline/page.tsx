import { redirect } from "next/navigation";
import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { StandaloneCircleContent } from "@/components/sheet/circle-content";

export const metadata = { title: "Circle Timeline — Cafe360" };

export default async function GroupTimelinePage({params,searchParams}:{params:Promise<{groupId:string}>;searchParams:Promise<{view?:string|string[]}>}) {
 const {groupId}=await params;
 const search=await searchParams;
 const view=search.view==="memories" ? "memories" : "activity";
 if (!hasSupabaseConfig()) return <div className="mx-auto max-w-2xl p-6"><p>Connect your account to see the Circle timeline.</p><Link href="/map" className="inline-flex min-h-11 items-center underline">Return to map</Link></div>;
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user) redirect(`/login?next=${encodeURIComponent(`/circles/${encodeURIComponent(groupId)}/timeline?view=${view}`)}`);
 return <StandaloneCircleContent accountId={user.id} circleId={groupId} view={view}/>;
}
