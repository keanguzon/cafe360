import { unstable_serialize } from "swr/infinite";
import type { ActivityCursor } from "@/lib/types/activity-page";

export const activityPageKey = (accountId: string, groupId: string, cursor: ActivityCursor | null = null) =>
  ["activity-feed", accountId, groupId, cursor] as const;
export const activityFeedCacheKey = (accountId: string, groupId: string) =>
  unstable_serialize(() => activityPageKey(accountId, groupId));
export function isCircleActivityKey(value: unknown, accountId: string, groupId: string) {
  return Array.isArray(value) && value[0] === "activity-feed" && value[1] === accountId && value[2] === groupId;
}
