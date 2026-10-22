"use client";

import { BottomSheet } from "@/components/layout/bottom-sheet";
import { ActivityFeed } from "@/components/social/activity-feed";
import { useCircle } from "@/lib/context/circle-context";
import type { Activity } from "@/lib/types/social";

type ActivityFeedSheetProps = { isOpen: boolean; onClose: () => void; onActivityTap?: (activity: Activity) => void };

export function ActivityFeedSheet({ isOpen, onClose, onActivityTap }: ActivityFeedSheetProps) {
  const { activeCircle } = useCircle();
  return <BottomSheet isOpen={isOpen} onClose={onClose} title={activeCircle ? `${activeCircle.name} Activity` : "Circle Activity"} snapPoint="half">
    <div className="pb-8"><ActivityFeed groupId={activeCircle?.id} onActivityTap={onActivityTap} /></div>
  </BottomSheet>;
}
