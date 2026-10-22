"use client";

import { ActivityFeed } from "./activity-feed";

export function GroupTimeline({ groupId }: { groupId: string }) {
  return <ActivityFeed groupId={groupId} />;
}
