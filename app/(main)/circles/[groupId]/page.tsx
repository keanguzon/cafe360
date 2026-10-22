import { notFound } from "next/navigation";
import { getGroupDetailsAction, getGroupSavedCafesAction } from "@/lib/actions/group-actions";
import { GroupDetailClient } from "./group-detail-client";

export async function generateMetadata({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const group = await getGroupDetailsAction(groupId);
  return { title: group ? `${group.name} — Cafe360` : "Group — Cafe360" };
}

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const [group, saves] = await Promise.all([
    getGroupDetailsAction(groupId),
    getGroupSavedCafesAction(groupId),
  ]);

  if (!group) notFound();

  return <GroupDetailClient group={group} saves={saves} />;
}
