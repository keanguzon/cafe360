import { redirect } from "next/navigation";
import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { CircleFullList } from "@/components/circle/circle-full-list";

export const metadata = { title: "Circle Cafés — Cafe360" };

export default async function CircleCafesPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  if (!hasSupabaseConfig()) return <div className="mx-auto max-w-2xl p-6"><p>Connect your account to see Circle cafés.</p><Link href="/map" className="inline-flex min-h-11 items-center underline">Return to map</Link></div>;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/circles/${encodeURIComponent(groupId)}/cafes`)}`);
  return <CircleFullList accountId={user.id} circleId={groupId} view="cafes"/>;
}
