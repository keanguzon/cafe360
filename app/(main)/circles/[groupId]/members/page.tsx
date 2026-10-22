import { redirect } from "next/navigation";
import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { CircleFullList } from "@/components/circle/circle-full-list";

export const metadata = { title: "Circle Members — Cafe360" };

export default async function CircleMembersPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  if (!hasSupabaseConfig()) return <div className="mx-auto max-w-2xl p-6"><p>Connect your account to see Circle members.</p><Link href="/map" className="inline-flex min-h-11 items-center underline">Return to map</Link></div>;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/circles/${encodeURIComponent(groupId)}/members`)}`);
  return <CircleFullList accountId={user.id} circleId={groupId} view="members"/>;
}
