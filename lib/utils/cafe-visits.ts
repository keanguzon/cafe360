import type { CircleCafeSummary } from "@/lib/types/circle-cafe";
import type { VisitWithDetails } from "@/lib/types/visit";

export function selectCafeVisits(
  visits: VisitWithDetails[],
  summaries: CircleCafeSummary[],
  cafeId: string,
  circleId: string | null,
) {
  if (!circleId) return [];
  const summary = summaries.find((item) => item.internalId === cafeId || item.providerId === cafeId);
  return visits.filter((visit) => {
    if (visit.group_id !== circleId) return false;
    const cafe = visit.cafe as { id?: string; provider_place_id?: string } | undefined;
    return visit.cafe_id === cafeId ||
      (summary ? visit.cafe_id === summary.internalId : false) ||
      cafe?.id === cafeId || cafe?.provider_place_id === cafeId;
  });
}
