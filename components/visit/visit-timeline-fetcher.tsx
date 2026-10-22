"use client";

import type { SheetRoute } from "@/lib/navigation/sheet-routes";
import { useMemo } from "react";
import { ReadFeedback } from "@/components/ui/read-feedback";
import { useCircle } from "@/lib/context/circle-context";
import { VisitTimeline } from "./visit-timeline";
import { selectCafeVisits } from "@/lib/utils/cafe-visits";

export function VisitTimelineFetcher({ cafeId, groupId, onOpen }: { cafeId: string; groupId: string | null; onOpen?: (route: SheetRoute) => void }) {
  const { accountId, activeCircle, circleVisits, circleCafeSummaries, isLoading, error, refreshCircleData } = useCircle();

  const visits = useMemo(() => {
    if (!groupId || activeCircle?.id !== groupId) return [];
    return selectCafeVisits(circleVisits, circleCafeSummaries, cafeId, groupId);
  }, [activeCircle?.id, cafeId, circleCafeSummaries, circleVisits, groupId]);

  if (groupId && activeCircle?.id === groupId && (isLoading || error) && visits.length === 0) {
    return (
      <div className="flex justify-center p-8 border border-border rounded-xl bg-muted/10">
        <ReadFeedback pending={isLoading} error={error} operationKey={`visits:${accountId}:${groupId}:${cafeId}`} label="Loading memories…" retry={refreshCircleData}/>
      </div>
    );
  }

  return <VisitTimeline visits={visits} onOpen={onOpen} />;
}
